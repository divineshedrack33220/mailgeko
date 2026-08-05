package svix

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"testing"
	"time"
)

func testSecret() string {
	// Arbitrary, non-credential key material constructed at runtime so the
	// source tree contains no literal that could be mistaken for a real secret.
	return "whsec_" + base64.StdEncoding.EncodeToString([]byte("test-key-only-not-a-real-secret-0123456789abcdef"))
}

func TestVerifyValid(t *testing.T) {
	body := []byte(`{"type":"email.opened"}`)
	now := time.Now().Unix()
	secret := testSecret()
	sig := sign(secret, body, "msg_123", now)

	if !Verify(body, secret, "msg_123", strconv.FormatInt(now, 10), "v1,"+sig) {
		t.Fatal("valid signature rejected")
	}
}

func TestVerifyTamperedBody(t *testing.T) {
	body := []byte(`{"type":"email.opened"}`)
	now := time.Now().Unix()
	secret := testSecret()
	sig := sign(secret, body, "msg_123", now)

	if Verify([]byte(`{"type":"email.clicked"}`), secret, "msg_123", strconv.FormatInt(now, 10), "v1,"+sig) {
		t.Fatal("tampered body accepted")
	}
}

func TestVerifyReplayWindow(t *testing.T) {
	body := []byte(`{"type":"email.opened"}`)
	old := time.Now().Add(-10 * time.Minute).Unix()
	secret := testSecret()
	sig := sign(secret, body, "msg_123", old)

	if Verify(body, secret, "msg_123", strconv.FormatInt(old, 10), "v1,"+sig) {
		t.Fatal("stale replay accepted")
	}
}

func TestVerifyMissingHeaders(t *testing.T) {
	secret := testSecret()
	if Verify([]byte(`{}`), secret, "", "123", "v1,x") {
		t.Fatal("empty id accepted")
	}
	if Verify([]byte(`{}`), secret, "id", "", "v1,x") {
		t.Fatal("empty timestamp accepted")
	}
	if Verify([]byte(`{}`), secret, "id", "123", "") {
		t.Fatal("empty signature accepted")
	}
	if Verify([]byte(`{}`), "", "id", "123", "v1,x") {
		t.Fatal("empty secret accepted")
	}
}

func sign(secret string, body []byte, id string, ts int64) string {
	key, _ := base64.StdEncoding.DecodeString(secret[6:])
	signed := []byte(id + "." + strconv.FormatInt(ts, 10) + ".")
	signed = append(signed, body...)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(signed)
	return base64.StdEncoding.EncodeToString(mac.Sum(nil))
}
