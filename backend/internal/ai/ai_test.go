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
