package auth

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
)

func totpCode(secret string) (string, error) {
	return totp.GenerateCode(secret, time.Now().UTC())
}

func TestGenerateTOTPSecret(t *testing.T) {
	secret, url, err := GenerateTOTPSecret("Mailgeko", "a@b.com")
	if err != nil {
		t.Fatalf("GenerateTOTPSecret: %v", err)
	}
	if !strings.HasPrefix(url, "otpauth://totp/") {
		t.Errorf("unexpected otpauth url: %s", url)
	}
	if !strings.Contains(url, "issuer=Mailgeko") {
		t.Errorf("url missing issuer: %s", url)
	}
	// Secret should be a valid base32 string (the library returns it decoded).
	if secret == "" {
		t.Error("expected non-empty secret")
	}
}

func TestValidateTOTPCode(t *testing.T) {
	secret, _, err := GenerateTOTPSecret("Mailgeko", "a@b.com")
	if err != nil {
		t.Fatalf("GenerateTOTPSecret: %v", err)
	}

	// Grab the current code using the same TOTP math.
	code, err := totpCode(secret)
	if err != nil {
		t.Fatalf("totpCode: %v", err)
	}
	if !ValidateTOTP(code, secret) {
		t.Error("expected a freshly generated code to validate")
	}
	if ValidateTOTP("000000", secret) {
		t.Error("expected a wrong code to fail")
	}
}

func TestRecoveryCodesRoundTrip(t *testing.T) {
	codes, err := GenerateRecoveryCodes(8)
	if err != nil {
		t.Fatalf("GenerateRecoveryCodes: %v", err)
	}
	if len(codes) != 8 {
		t.Fatalf("got %d codes, want 8", len(codes))
	}
	for _, c := range codes {
		if len(c) != len("xxxx-xxxx-xxxx") {
			t.Errorf("unexpected code length: %q", c)
		}
	}

	hashes := HashRecoveryCodes(codes)
	raw, _ := json.Marshal(hashes)

	// A valid code is consumed and removed.
	matched, remaining := ConsumeRecoveryCode(codes[0], string(raw))
	if !matched {
		t.Fatal("expected code to match")
	}
	if len(remaining) != 7 {
		t.Errorf("remaining = %d, want 7", len(remaining))
	}

	// The same code can no longer be used.
	raw2, _ := json.Marshal(remaining)
	matched, _ = ConsumeRecoveryCode(codes[0], string(raw2))
	if matched {
		t.Error("expected used code to be rejected")
	}

	// A bogus code does not match.
	matched, _ = ConsumeRecoveryCode("ZZZZ-ZZZZ-ZZZZ", string(raw))
	if matched {
		t.Error("expected bogus code to be rejected")
	}
}

func TestNormalizeRecoveryCode(t *testing.T) {
	if got := NormalizeRecoveryCode("  abcd-efgh-ijkl "); got != "ABCD-EFGH-IJKL" {
		t.Errorf("got %q", got)
	}
}
