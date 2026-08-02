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

	content, err := c.chat(ctx,
		"You reply with concise, high-converting email subject lines only.",
		b.String())
	if err != nil {
		return nil, err
	}

	lines := make([]string, 0, count)
	for _, line := range strings.Split(content, "\n") {
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

// CampaignOutput is a generated email campaign: a subject line and a body.
type CampaignOutput struct {
	Subject string
	Body    string
}

// GenerateCampaign writes a full campaign (subject + body) for the given
// prompt. draft, when provided, is rewritten instead of written from scratch.
// brandVoice tunes the output voice when set. It falls back to a template when
// no API key is configured.
func (c *Client) GenerateCampaign(ctx context.Context, prompt, draft, brandVoice string) (*CampaignOutput, error) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		prompt = "write a short promotional email"
	}
	if c.apiKey == "" {
		return fallbackCampaign(prompt, draft), nil
	}

	var b strings.Builder
	b.WriteString("You are an expert email marketing copywriter.")
	if brandVoice != "" {
		b.WriteString(" Write in this brand voice: ")
		b.WriteString(brandVoice)
		b.WriteString(".")
	}
	b.WriteString(" Write a complete email campaign. Instructions: ")
	b.WriteString(prompt)
	b.WriteString(".")
	if strings.TrimSpace(draft) != "" {
		b.WriteString(" Here is a draft to rewrite and improve (keep it concise):\n")
		b.WriteString(draft)
	}
	b.WriteString("\nUse {{first_name}} for the contact's first name. Keep the subject under 60 characters.")
	b.WriteString(" Return only the result in this exact format:\nSUBJECT: <subject line>\nBODY:\n<email body>")

	content, err := c.chat(ctx,
		"You write concise, high-converting marketing emails. Output only SUBJECT and BODY lines.",
		b.String())
	if err != nil {
		return nil, err
	}

	out := &CampaignOutput{}
	lines := strings.Split(content, "\n")
	for i, line := range lines {
		if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(line)), "SUBJECT:") {
			out.Subject = strings.TrimSpace(line[len("SUBJECT:"):])
		}
		if strings.HasPrefix(strings.ToUpper(strings.TrimSpace(line)), "BODY:") {
			out.Body = strings.Join(lines[i+1:], "\n")
			break
		}
	}
	if out.Subject == "" && out.Body == "" {
		first := strings.TrimSpace(content)
		if len(first) > 200 {
			first = first[:200]
		}
		out.Body = first
	}
	out.Subject = strings.TrimSpace(out.Subject)
	out.Body = strings.TrimSpace(out.Body)
	return out, nil
}

// chat calls the OpenAI-compatible chat completions endpoint and returns the
// assistant's text. It is only called when an API key is configured.
func (c *Client) chat(ctx context.Context, system, user string) (string, error) {
	body, err := json.Marshal(chatRequest{
		Model: c.model,
		Messages: []chatMessage{
			{Role: "system", Content: system},
			{Role: "user", Content: user},
		},
	})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("AI API returned %d: %s", resp.StatusCode, truncate(raw, 300))
	}

	var parsed chatResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return "", fmt.Errorf("AI API response: %w", err)
	}
	if len(parsed.Choices) == 0 || parsed.Choices[0].Message.Content == "" {
		return "", fmt.Errorf("AI API returned no suggestions")
	}
	return parsed.Choices[0].Message.Content, nil
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

func fallbackCampaign(prompt, draft string) *CampaignOutput {
	topic := strings.TrimSpace(prompt)
	if topic == "" {
		topic = "your product"
	}
	subject := "A quick update on " + topic
	body := "Hey {{first_name}},\n\nI wanted to share a quick update about " + topic + ".\n\n" +
		"Here's what's new and why it matters for you:\n\n" +
		"- It saves you time\n- It's easy to use\n- It just works\n\n" +
		"Reply to this email and I'll get back to you right away.\n\nBest,\nThe Mailgeko Team"
	if strings.TrimSpace(draft) != "" {
		body = strings.TrimSpace(draft)
	}
	return &CampaignOutput{Subject: subject, Body: body}
}

func truncate(b []byte, n int) string {
	if len(b) > n {
		return string(b[:n])
	}
	return string(b)
}
