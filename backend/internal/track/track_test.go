package track

import "testing"

func TestSignValid(t *testing.T) {
	secret := "dev-secret"
	provided := Sign(secret, "click", "campaign-1", "contact-1", "https://example.com")
	if !Valid(secret, "click", provided, "campaign-1", "contact-1", "https://example.com") {
		t.Fatal("valid signature rejected")
	}
	if Valid(secret, "click", provided, "campaign-1", "contact-1", "https://evil.com") {
		t.Fatal("tampered target accepted")
	}
	if Valid(secret, "open", provided, "campaign-1", "contact-1") {
		t.Fatal("signature for another kind accepted")
	}
	if Valid("other-secret", "click", provided, "campaign-1", "contact-1", "https://example.com") {
		t.Fatal("signature under another secret accepted")
	}
	if Valid(secret, "click", "", "campaign-1", "contact-1", "https://example.com") {
		t.Fatal("empty signature accepted")
	}
}

func TestSigningDeterministic(t *testing.T) {
	a := Sign("s", "open", "c", "m")
	b := Sign("s", "open", "c", "m")
	if a != b {
		t.Fatalf("signing not deterministic: %s vs %s", a, b)
	}
}
