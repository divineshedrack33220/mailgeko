package embed

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStaticDeterministicAndSimilar(t *testing.T) {
	e := NewStatic(16)
	ctx := context.Background()

	a1, _ := e.Embed(ctx, []string{"Head of Marketing at Acme Corp, enterprise plan"})
	b1, _ := e.Embed(ctx, []string{"Head of Marketing at Acme Corp, enterprise plan"})
	c1, _ := e.Embed(ctx, []string{"Software engineer at a startup"})

	if !sameVec(a1[0], b1[0]) {
		t.Fatal("same text should produce the same vector")
	}
	if sameVec(a1[0], c1[0]) {
		t.Fatal("different text should produce a different vector")
	}

	sim := cosine(a1[0], c1[0])
	if sim >= 0.999 {
		t.Fatalf("unrelated texts should not be near-identical, similarity=%f", sim)
	}
	if len(a1[0]) != 16 {
		t.Fatalf("expected 16 dims, got %d", len(a1[0]))
	}
}

func TestOpenAIEmbed(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/embeddings" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Fatalf("missing auth header: %q", r.Header.Get("Authorization"))
		}
		var req embedRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req.Model != "text-embedding-3-small" || len(req.Input) != 2 {
			t.Fatalf("unexpected request: %+v", req)
		}
		_ = json.NewEncoder(w).Encode(embedResponse{Data: []struct {
			Embedding []float32 `json:"embedding"`
			Index     int       `json:"index"`
		}{
			{Embedding: []float32{0.1, 0.2, 0.3}, Index: 0},
			{Embedding: []float32{0.4, 0.5, 0.6}, Index: 1},
		}})
	}))
	defer ts.Close()

	e := NewOpenAI(ts.URL, "test-key", "", 3)
	ctx := context.Background()
	got, err := e.Embed(ctx, []string{"hello", "world"})
	if err != nil {
		t.Fatalf("Embed: %v", err)
	}
	if len(got) != 2 || got[0][1] != 0.2 || got[1][2] != 0.6 {
		t.Fatalf("unexpected embeddings: %v", got)
	}
}

func TestOpenAIError(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":"insufficient_quota"}`, http.StatusTooManyRequests)
	}))
	defer ts.Close()

	e := NewOpenAI(ts.URL, "k", "", 3)
	if _, err := e.Embed(context.Background(), []string{"x"}); err == nil {
		t.Fatal("expected error on 429")
	}
}

func sameVec(a, b []float32) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func cosine(a, b []float32) float64 {
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i] * b[i])
		na += float64(a[i] * a[i])
		nb += float64(b[i] * b[i])
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb))
}
