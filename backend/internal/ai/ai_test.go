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

