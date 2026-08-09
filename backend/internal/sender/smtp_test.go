package sender

import (
	"bufio"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"fmt"
	"math/big"
	"net"
	"strconv"
	"strings"
	"testing"
	"time"
)

// fakeSMTPServer is a minimal SMTP server that supports STARTTLS and
// PLAIN auth and records the last message delivered.
type fakeSMTPServer struct {
	ln        net.Listener
	lastMsg   string
	gotAuth   bool
	t         *testing.T
	tlsConfig *tls.Config
}

func newFakeSMTPServer(t *testing.T) *fakeSMTPServer {
	t.Helper()
	cert := selfSignedCert(t, "localhost")
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	s := &fakeSMTPServer{
		ln:        ln,
		t:         t,
		tlsConfig: &tls.Config{Certificates: []tls.Certificate{cert}},
	}
	go s.serve()
	t.Cleanup(func() { ln.Close() })
	return s
}

func selfSignedCert(t *testing.T, host string) tls.Certificate {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("rsa: %v", err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: host},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		KeyUsage:     x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		DNSNames:     []string{host},
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatalf("create cert: %v", err)
	}
	return tls.Certificate{
		Certificate: [][]byte{der},
		PrivateKey:  key,
	}
}

func (s *fakeSMTPServer) addr() string { return s.ln.Addr().String() }

func certPoolFor(t *testing.T, tlsCfg *tls.Config) *x509.CertPool {
	t.Helper()
	pool := x509.NewCertPool()
	for _, der := range tlsCfg.Certificates[0].Certificate {
		cert, err := x509.ParseCertificate(der)
		if err != nil {
			t.Fatalf("parse cert: %v", err)
		}
		pool.AddCert(cert)
	}
	return pool
}

func (s *fakeSMTPServer) serve() {
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			return
		}
		go s.handle(conn)
	}
}

func (s *fakeSMTPServer) handle(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	w := bufio.NewWriter(conn)
	say := func(line string) { fmt.Fprint(w, line); w.Flush() }

	say("220 fake ESMTP\r\n")
	tlsUp := false
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		line = strings.TrimRight(line, "\r\n")
		cmd := strings.ToUpper(line)
		switch {
		case strings.HasPrefix(cmd, "EHLO"):
			if tlsUp {
				say("250-fake ESMTP\r\n250 AUTH PLAIN LOGIN\r\n")
			} else {
				say("250-fake ESMTP\r\n250-STARTTLS\r\n250 AUTH PLAIN LOGIN\r\n")
			}
		case strings.HasPrefix(cmd, "STARTTLS"):
			say("220 Go ahead\r\n")
			tlsConn := tls.Server(conn, s.tlsConfig)
			if err := tlsConn.Handshake(); err != nil {
				return
			}
			conn = tlsConn
			r = bufio.NewReader(conn)
			w = bufio.NewWriter(conn)
			tlsUp = true
		case strings.HasPrefix(cmd, "AUTH PLAIN"):
			encoded := strings.TrimSpace(strings.TrimPrefix(line, "AUTH PLAIN"))
			decoded, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil || !strings.Contains(string(decoded), "\x00") {
				say("501 bad auth\r\n")
				continue
			}
			s.gotAuth = true
			say("235 ok\r\n")
		case strings.HasPrefix(cmd, "MAIL FROM"):
			say("250 ok\r\n")
		case strings.HasPrefix(cmd, "RCPT TO"):
			say("250 ok\r\n")
		case strings.HasPrefix(cmd, "DATA"):
			say("354 go ahead\r\n")
			var sb strings.Builder
			for {
				ml, err := r.ReadString('\n')
				if err != nil {
					return
				}
				if ml == ".\r\n" {
					break
				}
				sb.WriteString(ml)
			}
			s.lastMsg = sb.String()
			say("250 queued\r\n")
		case strings.HasPrefix(cmd, "QUIT"):
			say("221 bye\r\n")
			return
		default:
			say("250 ok\r\n")
		}
	}
}

func TestSMTPClientSend(t *testing.T) {
	srv := newFakeSMTPServer(t)
	_, portStr, err := net.SplitHostPort(srv.addr())
	if err != nil {
		t.Fatalf("split host port: %v", err)
	}
	port, _ := strconv.Atoi(portStr)

	client := NewSMTPClient(SMTPConfig{
		Host:      "localhost",
		Port:      port,
		Username:  "me@example.com",
		Password:  "hunter2",
		FromName:  "Jane",
		FromEmail: "jane@example.com",
	})
	client.tlsConfig = &tls.Config{RootCAs: certPoolFor(t, srv.tlsConfig), MinVersion: tls.VersionTLS12}
	result, err := client.Send(context.Background(), Message{
		From:    "Jane <jane@example.com>",
		To:      "bob@example.com",
		Subject: "Hello ☺",
		HTML:    "<p>Hi there</p>",
		Headers: map[string]string{"X-Custom": "yes"},
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if result.Status != 250 {
		t.Fatalf("status = %d, want 250", result.Status)
	}
	if result.MessageID == "" {
		t.Fatal("expected a message id")
	}
	if !srv.gotAuth {
		t.Fatal("expected AUTH to be attempted")
	}
	if !strings.Contains(srv.lastMsg, "From: Jane <jane@example.com>") {
		t.Errorf("missing From header: %q", srv.lastMsg)
	}
	if !strings.Contains(srv.lastMsg, "To: bob@example.com") {
		t.Errorf("missing To header: %q", srv.lastMsg)
	}
	if !strings.Contains(srv.lastMsg, "Subject: =?UTF-8?q?Hello_=E2=98=BA?=") {
		t.Errorf("subject not encoded: %q", srv.lastMsg)
	}
	if !strings.Contains(srv.lastMsg, "X-Custom: yes") {
		t.Errorf("missing custom header: %q", srv.lastMsg)
	}
	if !strings.Contains(srv.lastMsg, "<p>Hi there</p>") {
		t.Errorf("missing body: %q", srv.lastMsg)
	}
	if !strings.Contains(srv.lastMsg, "Message-ID: <"+result.MessageID+">") {
		t.Errorf("message-id mismatch: %q", srv.lastMsg)
	}
}

func TestBuildSMTPMessageQuotedPrintable(t *testing.T) {
	msg := buildSMTPMessage(Message{
		From:    "Jane <jane@example.com>",
		To:      "bob@example.com",
		Subject: "hi",
		Text:    "café ☕",
	}, nil, nil, "abc@example.com")
	if !strings.Contains(string(msg), "caf=C3=A9 =E2=98=95") {
		t.Errorf("body not quoted-printable encoded: %q", msg)
	}
}
