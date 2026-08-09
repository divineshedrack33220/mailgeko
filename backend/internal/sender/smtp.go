package sender

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

// SMTPConfig describes a per-workspace SMTP mailbox used to send marketing
// email (campaigns, automations, 1-to-1 emails, and test sends).
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	FromName string
	FromEmail string
	ReplyTo  string
}

// SMTPClient sends email through a user's own SMTP server. It supports
// implicit TLS (port 465) and STARTTLS (587 / 25) with PLAIN or LOGIN auth.
type SMTPClient struct {
	cfg SMTPConfig
	// tlsConfig overrides the client TLS configuration. It exists so tests can
	// trust a self-signed certificate; production code leaves it nil.
	tlsConfig *tls.Config
}

func NewSMTPClient(cfg SMTPConfig) *SMTPClient {
	return &SMTPClient{cfg: cfg}
}

// From returns the fully formatted From address of the SMTP mailbox.
func (c *SMTPClient) From() string {
	if c.cfg.FromName != "" && c.cfg.FromEmail != "" {
		return c.cfg.FromName + " <" + c.cfg.FromEmail + ">"
	}
	return c.cfg.FromEmail
}

// ReplyTo returns the configured reply-to address (empty if unset).
func (c *SMTPClient) ReplyTo() string {
	return c.cfg.ReplyTo
}

// Send delivers one message and returns a synthetic message id that is used
// as the send idempotency marker (mirroring Resend's message id).
func (c *SMTPClient) Send(ctx context.Context, msg Message) (*SendResult, error) {
	cfg := c.cfg
	addr := net.JoinHostPort(cfg.Host, fmt.Sprintf("%d", cfg.Port))

	dialer := &net.Dialer{Timeout: 20 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("smtp: dial %s: %w", addr, err)
	}

	clientTLS := c.tlsConfig
	if clientTLS == nil {
		clientTLS = &tls.Config{ServerName: cfg.Host, MinVersion: tls.VersionTLS12}
	} else if clientTLS.ServerName == "" {
		clientTLS.ServerName = cfg.Host
	}

	var client *smtp.Client
	if cfg.Port == 465 {
		tlsConn := tls.Client(conn, clientTLS)
		if err := tlsConn.HandshakeContext(ctx); err != nil {
			conn.Close()
			return nil, fmt.Errorf("smtp: tls handshake: %w", err)
		}
		client, err = smtp.NewClient(tlsConn, cfg.Host)
	} else {
		client, err = smtp.NewClient(conn, cfg.Host)
	}
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("smtp: client: %w", err)
	}
	defer client.Close()

	if cfg.Port != 465 {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(clientTLS); err != nil {
				return nil, fmt.Errorf("smtp: starttls: %w", err)
			}
		}
	}

	if cfg.Username != "" {
		auth, err := selectAuth(client, cfg)
		if err != nil {
			return nil, err
		}
		if err := client.Auth(auth); err != nil {
			return nil, fmt.Errorf("smtp: auth: %w", err)
		}
	}

	fromAddr, err := parseAddress(msg.From)
	if err != nil {
		return nil, fmt.Errorf("smtp: invalid from %q: %w", msg.From, err)
	}
	toAddr, err := parseAddress(msg.To)
	if err != nil {
		return nil, fmt.Errorf("smtp: invalid to %q: %w", msg.To, err)
	}
	if err := client.Mail(fromAddr.Address); err != nil {
		return nil, fmt.Errorf("smtp: mail: %w", err)
	}
	if err := client.Rcpt(toAddr.Address); err != nil {
		return nil, fmt.Errorf("smtp: rcpt: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return nil, fmt.Errorf("smtp: data: %w", err)
	}

	id := newMessageID(fromAddr.Address)
	raw := buildSMTPMessage(msg, fromAddr, toAddr, id)
	if _, err := w.Write(raw); err != nil {
		w.Close()
		return nil, fmt.Errorf("smtp: write: %w", err)
	}
	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("smtp: send: %w", err)
	}
	if err := client.Quit(); err != nil {
		return nil, fmt.Errorf("smtp: quit: %w", err)
	}

	return &SendResult{Status: 250, MessageID: id}, nil
}

// selectAuth picks a usable auth mechanism advertised by the server, preferring
// PLAIN and falling back to LOGIN (used by Outlook/Office 365).
func selectAuth(client *smtp.Client, cfg SMTPConfig) (smtp.Auth, error) {
	ok, mechs := client.Extension("AUTH")
	if !ok || mechs == "" {
		return nil, fmt.Errorf("smtp: server requires auth but does not advertise an AUTH mechanism")
	}
	mechs = strings.ToUpper(mechs)
	switch {
	case strings.Contains(mechs, "PLAIN"):
		return smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host), nil
	case strings.Contains(mechs, "LOGIN"):
		return &loginAuth{username: cfg.Username, password: cfg.Password}, nil
	}
	return nil, fmt.Errorf("smtp: no supported auth mechanism (advertised: %s)", mechs)
}

// loginAuth implements the SMTP LOGIN auth mechanism for servers that do not
// advertise PLAIN. It is not needed over insecure connections because AUTH is
// only attempted after TLS (implicit or STARTTLS).
type loginAuth struct {
	username string
	password string
}

func (a *loginAuth) Start(_ *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}
	if strings.Contains(strings.ToLower(string(fromServer)), "user") {
		return []byte(a.username), nil
	}
	return []byte(a.password), nil
}

// buildSMTPMessage renders a minimal MIME message. The Message-ID doubles as
// the idempotency marker for campaign recipients.
func buildSMTPMessage(msg Message, from, to *mail.Address, messageID string) []byte {
	var buf bytes.Buffer

	subject := msg.Subject
	if subject == "" {
		subject = " "
	}
	buf.WriteString("From: " + msg.From + "\r\n")
	buf.WriteString("To: " + msg.To + "\r\n")
	buf.WriteString("Subject: " + mime.QEncoding.Encode("UTF-8", subject) + "\r\n")
	buf.WriteString("Message-ID: <" + messageID + ">\r\n")
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString("Date: " + time.Now().UTC().Format(time.RFC1123Z) + "\r\n")

	if msg.ReplyTo != "" {
		buf.WriteString("Reply-To: " + msg.ReplyTo + "\r\n")
	}
	for k, v := range msg.Headers {
		if strings.EqualFold(k, "From") || strings.EqualFold(k, "To") || strings.EqualFold(k, "Subject") {
			continue
		}
		if !strings.Contains(k, "\r\n") && !strings.Contains(v, "\r\n") {
			buf.WriteString(k + ": " + v + "\r\n")
		}
	}

	body := msg.Text
	ctype := "text/plain"
	if msg.HTML != "" {
		body = msg.HTML
		ctype = "text/html"
	}
	buf.WriteString("Content-Type: " + ctype + "; charset=utf-8\r\n")
	buf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
	buf.WriteString(quotePrintable(body))
	return buf.Bytes()
}

func parseAddress(s string) (*mail.Address, error) {
	addr, err := mail.ParseAddress(s)
	if err != nil {
		return nil, err
	}
	return addr, nil
}

func newMessageID(from string) string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("mailgeko-%d@%s", time.Now().UnixNano(), "mailgeko.local")
	}
	domain := "mailgeko.local"
	if at := strings.LastIndex(from, "@"); at >= 0 && at < len(from)-1 {
		domain = from[at+1:]
	}
	return hex.EncodeToString(b) + "@" + strings.ToLower(domain)
}
