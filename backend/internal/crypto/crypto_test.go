package crypto

import "testing"

func TestEncryptRoundTrip(t *testing.T) {
	e, err := New("test-secret")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	plain := []byte("super-secret-smtp-password")
	sealed, err := e.Encrypt(plain)
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	if string(sealed) == string(plain) {
		t.Fatal("sealed value must not equal plaintext")
	}
	got, err := e.Decrypt(sealed)
	if err != nil {
		t.Fatalf("Decrypt: %v", err)
	}
	if string(got) != string(plain) {
		t.Fatalf("round trip mismatch: got %q want %q", got, plain)
	}
}

func TestNewRejectsEmptySecret(t *testing.T) {
	if _, err := New(""); err == nil {
		t.Fatal("expected error for empty secret")
	}
}

func TestDecryptTampered(t *testing.T) {
	e, err := New("test-secret")
	if err != nil {
		t.Fatalf("New: %v", err)
	}
	sealed, err := e.Encrypt([]byte("secret"))
	if err != nil {
		t.Fatalf("Encrypt: %v", err)
	}
	sealed[len(sealed)-1] ^= 0xff
	if _, err := e.Decrypt(sealed); err == nil {
		t.Fatal("expected error for tampered ciphertext")
	}
}
