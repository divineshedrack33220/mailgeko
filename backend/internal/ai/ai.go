package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client generates marketing copy (currently subject lines) through an
// OpenAI-compatible chat completions endpoint. When no API key is configured
// it falls back to deterministic, template-based suggestions so the feature
// works end-to-end in local development and smoke tests.
type Client struct {
	baseURL    string
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewClient(baseURL, apiKey, model string) *Client {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = "gpt-4o-mini"
	}
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		model:      model,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// GenerateSubjectLines returns up to count subject line suggestions for the
// given topic. audience and tone are optional and influence the suggestions.
func (c *Client) GenerateSubjectLines(ctx context.Context, topic, audience, tone string, count int) ([]string, error) {
	topic = strings.TrimSpace(topic)
	if topic == "" {
		topic = "your product"
	}
	if count <= 0 {
		count = 3
	}
	if count > 6 {
		count = 6
	}
	if c.apiKey == "" {
		return fallbackSubjectLines(topic, audience, tone, count), nil
	}
	return c.chatSubjectLines(ctx, topic, audience, tone, count)
}

type chatRequest struct {
	Model    string        `json:"model"`
	Messages []chatMessage `json:"messages"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (c *Client) chatSubjectLines(ctx context.Context, topic, audience, tone string, count int) ([]string, error) {
	var b strings.Builder
	b.WriteString("You are an expert email marketing copywriter. Write ")
	b.WriteString(fmt.Sprintf("%d distinct email subject lines", count))
	b.WriteString(" for a message about: ")
	b.WriteString(topic)
	if audience != "" {
		b.WriteString(". The audience is: ")
		b.WriteString(audience)
	}
	if tone != "" {
		b.WriteString(". Use a ")
		b.WriteString(tone)
		b.WriteString(" tone.")
	}
	b.WriteString(" Keep each line under 60 characters. Return only the subject lines, one per line, no numbering, no quotes, no extra text.")

	body, err := json.Marshal(chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: "You reply with concise, high-converting email subject lines only."},
			{Role: "user", Content: b.String()},
		},
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI API returned %d: %s", resp.StatusCode, truncate(raw, 300))
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("AI API response: %w", err)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return nil, fmt.Errorf("AI API returned no suggestions")
	}

	lines := make([]string, 0, count)
	for _, line := range strings.Split(parsed.Choices[0].Message.Content, "\n") {
		line = strings.Trim(line, " \t-•\"“”")
		if line != "" {
			lines = append(lines, line)
		}
	}
	if len(lines) > count {
		lines = lines[:count]
	}
	return lines, nil
}

func fallbackSubjectLines(topic, audience, tone string, count int) []string {
	topic = strings.TrimSpace(topic)
	if topic == "" {
		topic = "your product"
	}
	templates := []string{
		topic,
		"Is " + strings.ToLower(topic) + " on your radar?",
		"Don't miss out on " + topic,
		"How to make the most of " + topic,
		"A quick note about " + topic,
		"Unlock the full potential of " + topic,
	}
	if len(templates) > count {
		templates = templates[:count]
	}
	return templates
}

func truncate(b []byte, n int) string {
	if len(b) > n {
		return string(b[:n])
	}
	return string(b)
}
