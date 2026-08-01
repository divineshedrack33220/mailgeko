package sender

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestSend(t *testing.T) {
	var mu sync.Mutex
	var gotAuthorization string
	var gotMessage Message

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		gotAuthorization = r.Header.Get("Authorization")
		_ = json.NewDecoder(r.Body).Decode(&gotMessage)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg-123"}`))
	}))
	defer server.Close()

	client := NewWithEndpoint([]string{"re_key1"}, server.URL)
	result, err := client.Send(context.Background(), Message{
		From:    "Team <team@example.com>",
		To:      "user@example.com",
		Subject: "Hello",
		HTML:    "<p>Hi</p>",
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if result.MessageID != "msg-123" {
		t.Errorf("MessageID = %q, want msg-123", result.MessageID)
	}
	mu.Lock()
	defer mu.Unlock()
	if gotAuthorization != "Bearer re_key1" {
		t.Errorf("Authorization = %q", gotAuthorization)
	}
	if gotMessage.To != "user@example.com" || gotMessage.Subject != "Hello" {
		t.Errorf("unexpected message: %+v", gotMessage)
	}
}

func TestSendRotatesKeys(t *testing.T) {
	var mu sync.Mutex
	var keys []string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		keys = append(keys, r.Header.Get("Authorization"))
		mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"msg"}`))
	}))
	defer server.Close()

	client := NewWithEndpoint([]string{"re_key_a", "re_key_b"}, server.URL)
	for i := 0; i < 4; i++ {
		if _, err := client.Send(context.Background(), Message{To: "a@b.c"}); err != nil {
			t.Fatalf("Send %d: %v", i, err)
		}
	}

	mu.Lock()
	defer mu.Unlock()
	want := []string{"Bearer re_key_a", "Bearer re_key_b", "Bearer re_key_a", "Bearer re_key_b"}
	if strings.Join(keys, ",") != strings.Join(want, ",") {
		t.Errorf("keys rotation = %v, want %v", keys, want)
	}
}

func TestSendError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"name":"validation_error","message":"bad email"}`, http.StatusUnprocessableEntity)
	}))
	defer server.Close()

	client := NewWithEndpoint([]string{"re_key1"}, server.URL)
	_, err := client.Send(context.Background(), Message{To: "nope"})
	if err == nil {
		t.Fatal("expected error for 422 response")
	}
	if !strings.Contains(err.Error(), "422") {
		t.Errorf("error should mention status: %v", err)
	}
}

func TestSendNoKeys(t *testing.T) {
	client := New(nil)
	if _, err := client.Send(context.Background(), Message{}); err == nil {
		t.Fatal("expected error with no keys")
	}
}
