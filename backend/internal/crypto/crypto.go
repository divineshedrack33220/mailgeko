// Package crypto encrypts secrets at rest using AES-256-GCM.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"
)

// Encryptor encrypts/decrypts values with a fixed key. The zero value is
// invalid; build one with New.
type Encryptor struct {
	aead cipher.AEAD
}

// New derives a 32-byte key from the given secret and returns an Encryptor.
func New(secret string) (*Encryptor, error) {
	if secret == "" {
		return nil, errors.New("crypto: empty secret")
	}
	sum := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(sum[:])
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Encryptor{aead: aead}, nil
}

// Encrypt seals plaintext. The output is nonce || ciphertext.
func (e *Encryptor) Encrypt(plaintext []byte) ([]byte, error) {
	nonce := make([]byte, e.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	return e.aead.Seal(nonce, nonce, plaintext, nil), nil
}

// Decrypt opens a value produced by Encrypt.
func (e *Encryptor) Decrypt(sealed []byte) ([]byte, error) {
	if len(sealed) < e.aead.NonceSize() {
		return nil, errors.New("crypto: sealed value too short")
	}
	nonce, ciphertext := sealed[:e.aead.NonceSize()], sealed[e.aead.NonceSize():]
	return e.aead.Open(nil, nonce, ciphertext, nil)
}
