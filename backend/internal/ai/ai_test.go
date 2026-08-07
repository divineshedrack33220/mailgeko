package ai

import (
	"context"
	"strings"
	"testing"
)

func TestGenerateSubjectLinesFallback(t *testing.T) {
	c := NewClient("", "", "")

	subjects, err := c.GenerateSubjectLines(context.Background(), "Spring Sale", "subscribers", "friendly", 3)
	if err != nil {
		t.Fatalf("GenerateSubjectLines returned error: %v", err)
	}
	if len(subjects) != 3 {
		t.Fatalf("expected 3 subjects, got %d: %v", len(subjects), subjects)
	}
	for _, s := range subjects {
		if strings.TrimSpace(s) == "" {
			t.Fatalf("got empty subject line")
		}
	}

	limited, err := c.GenerateSubjectLines(context.Background(), "Launch", "", "", 99)
	if err != nil {
		t.Fatalf("GenerateSubjectLines returned error: %v", err)
	}
	if len(limited) != 6 {
		t.Fatalf("expected subjects capped at 6, got %d", len(limited))
	}
}

func TestGenerateSubjectLinesRequiresTopic(t *testing.T) {
	c := NewClient("", "", "")
	subjects, err := c.GenerateSubjectLines(context.Background(), "   ", "", "", 3)
	if err != nil {
		t.Fatalf("GenerateSubjectLines returned error: %v", err)
	}
	if len(subjects) != 3 {
		t.Fatalf("expected 3 subjects, got %d", len(subjects))
	}
}

func TestGenerateCampaignFallback(t *testing.T) {
	c := NewClient("", "", "")
	out, err := c.GenerateCampaign(context.Background(), "announce the new AI studio", "", "")
	if err != nil {
		t.Fatalf("GenerateCampaign returned error: %v", err)
	}
	if strings.TrimSpace(out.Subject) == "" {
		t.Fatalf("expected a subject line, got empty")
	}
	if !strings.Contains(out.Body, "{{first_name}}") {
		t.Fatalf("expected {{first_name}} variable in body, got: %s", out.Body)
	}

	draftOut, err := c.GenerateCampaign(context.Background(), "improve this draft", "Hello all, big news soon.", "")
	if err != nil {
		t.Fatalf("GenerateCampaign with draft returned error: %v", err)
	}
	if !strings.Contains(draftOut.Body, "big news") {
		t.Fatalf("expected draft to be reused in fallback, got: %s", draftOut.Body)
	}
}

func TestGenerateTemplateFallback(t *testing.T) {
	c := NewClient("", "", "")
	d, err := c.GenerateTemplate(context.Background(), "welcome email for new SaaS signups", "")
	if err != nil {
		t.Fatalf("GenerateTemplate returned error: %v", err)
	}
	if strings.TrimSpace(d.Body) == "" || strings.TrimSpace(d.Heading) == "" {
		t.Fatalf("expected heading and body, got %+v", d)
	}
}

func TestChatFallback(t *testing.T) {
	c := NewClient("", "", "")

	subjectReply, err := c.Chat(context.Background(), "system", []ChatMessage{{Role: "user", Content: "Write subject lines for a spring sale"}})
	if err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}
	if !strings.Contains(subjectReply, "spring sale") {
		t.Fatalf("expected subject fallback to reference the topic, got: %s", subjectReply)
	}

	analyticsReply, err := c.Chat(context.Background(), "system", []ChatMessage{{Role: "user", Content: "What is my open rate?"}})
	if err != nil {
		t.Fatalf("Chat returned error: %v", err)
	}
	if strings.Contains(analyticsReply, "%") && !strings.Contains(analyticsReply, "invent") {
		t.Fatalf("analytics fallback must not fabricate metrics, got: %s", analyticsReply)
	}
	if !strings.Contains(strings.ToLower(analyticsReply), "analytics") {
		t.Fatalf("analytics fallback should point to the dashboard, got: %s", analyticsReply)
	}
}

func TestParseTemplateJSON(t *testing.T) {
	d, err := parseTemplateJSON(`{"name":"Welcome","category":"Welcome","subject":"Welcome aboard","heading":"Hi {{first_name}}","body":"Paragraph one.\n\nParagraph two.","cta":"Get started"}`)
	if err != nil {
		t.Fatalf("parseTemplateJSON returned error: %v", err)
	}
	if d.Name != "Welcome" || !strings.Contains(d.Body, "Paragraph two") {
		t.Fatalf("unexpected parse result: %+v", d)
	}

	fenced, err := parseTemplateJSON("```json\n{\"name\":\"X\",\"body\":\"Hello\"}\n```")
	if err != nil {
		t.Fatalf("parseTemplateJSON fenced returned error: %v", err)
	}
	if fenced.Name != "X" || fenced.Body != "Hello" {
		t.Fatalf("unexpected fenced parse result: %+v", fenced)
	}

	rawNewline, err := parseTemplateJSON("{\"name\":\"Y\",\"body\":\"Line one.\nLine two.\",\"heading\":\"Hi\"}")
	if err != nil {
		t.Fatalf("parseTemplateJSON raw-newline returned error: %v", err)
	}
	if !strings.Contains(rawNewline.Body, "Line two") {
		t.Fatalf("unexpected raw-newline parse result: %+v", rawNewline)
	}
}


