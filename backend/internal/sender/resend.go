package sender

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync/atomic"
	"time"
)

const resendEndpoint = "https://api.resend.com/emails"

type Message struct {
	From    string            `json:"from"`
	To      string            `json:"to"`
	Subject string            `json:"subject"`
	HTML    string            `json:"html,omitempty"`
	Text    string            `json:"text,omitempty"`
	ReplyTo string            `json:"reply_to,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Tags    []Tag             `json:"tags,omitempty"`
}

type Tag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type SendResult struct {
	MessageID string
	Status    int
	Error     string
}

type Client struct {
	http     *http.Client
	keys     []string
	endpoint string
	cursor   atomic.Uint64
}

func New(keys []string) *Client {
	return &Client{
		http:     &http.Client{Timeout: 20 * time.Second},
		keys:     keys,
		endpoint: resendEndpoint,
	}
}

func NewWithEndpoint(keys []string, endpoint string) *Client {
	c := New(keys)
	c.endpoint = endpoint
	return c
}

func NewConfigured(keys []string, endpoint string) *Client {
	if endpoint == "" {
		return New(keys)
	}
	return NewWithEndpoint(keys, endpoint)
}

func (c *Client) Send(ctx context.Context, msg Message) (*SendResult, error) {
	if len(c.keys) == 0 {
		return nil, fmt.Errorf("sender: no API keys configured")
	}

	idx := c.cursor.Add(1) - 1
	key := c.keys[idx%uint64(len(c.keys))]

	body, err := json.Marshal(msg)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	payload, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return &SendResult{Status: resp.StatusCode, Error: string(payload)}, fmt.Errorf("sender: resend returned %d: %s", resp.StatusCode, string(payload))
	}

	var out struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(payload, &out); err != nil {
		return &SendResult{Status: resp.StatusCode}, fmt.Errorf("sender: unexpected resend response: %w", err)
	}
	return &SendResult{Status: resp.StatusCode, MessageID: out.ID}, nil
}
