package svix

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"testing"
	"time"
)

const testSecret = "whsec_MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAIbNpBFO8dxjTsluT6C1nR+1BnUq8UG6Bpv5jqYExgM2bFUJ4CwWjYV+4nX9cJ8MDPNVzEJnJzU0lJp8yO2rW5JXgxkCAwEAAQ=="

func TestVerifyValid(t *testing.T) {
	body := []byte(`{"type":"email.opened"}`)
	now := time.Now().Unix()
	sig := sign(body, "msg_123", now)

	if !Verify(body, testSecret, "msg_123", strconv.FormatInt(now, 10), "v1,"+sig) {
		t.Fatal("valid signature rejected")
	}
}

func TestVerifyTamperedBody(t *testing.T) {
	body := []byte(`{"type":"email.opened"}`)
	now := time.Now().Unix()
	sig := sign(body, "msg_123", now)

	if Verify([]byte(`{"type":"email.clicked"}`), testSecret, "msg_123", strconv.FormatInt(now, 10), "v1,"+sig) {
		t.Fatal("tampered body accepted")
	}
}

func TestVerifyReplayWindow(t *testing.T) {
	body := []byte(`{"type":"email.opened"}`)
	old := time.Now().Add(-10 * time.Minute).Unix()
	sig := sign(body, "msg_123", old)

	if Verify(body, testSecret, "msg_123", strconv.FormatInt(old, 10), "v1,"+sig) {
		t.Fatal("stale replay accepted")
	}
}

func TestVerifyMissingHeaders(t *testing.T) {
	if Verify([]byte(`{}`), testSecret, "", "123", "v1,x") {
		t.Fatal("empty id accepted")
	}
	if Verify([]byte(`{}`), testSecret, "id", "", "v1,x") {
		t.Fatal("empty timestamp accepted")
	}
	if Verify([]byte(`{}`), testSecret, "id", "123", "") {
		t.Fatal("empty signature accepted")
	}
	if Verify([]byte(`{}`), "", "id", "123", "v1,x") {
		t.Fatal("empty secret accepted")
	}
}

func sign(body []byte, id string, ts int64) string {
	key, _ := base64.StdEncoding.DecodeString(testSecret[6:])
	signed := []byte(id + "." + strconv.FormatInt(ts, 10) + ".")
	signed = append(signed, body...)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(signed)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
