package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

var (
	ErrInvalidHash  = errors.New("auth: invalid password hash format")
	ErrInvalidToken = errors.New("auth: invalid password token format")
	ErrUnsafeHash   = errors.New("auth: password hash parameters exceed safety limits")
)

const (
	argonTime    = 3
	argonMemory  = 64 * 1024
	argonThreads = 2
	argonKeyLen  = 32
	argonSaltLen = 16

	// Accepted bounds for hashes presented for verification. A password
	// database entry must never be able to force an unbounded argon2 run
	// (memory OOM or int overflow on the params parsed from the hash).
	minArgonMemory  = 8 * 1024
	maxArgonMemory  = 1 << 30 // 1 GiB
	maxArgonTime    = 100
	maxArgonThreads = 255
	minArgonSaltLen = 8
	minArgonKeyLen  = 16
	maxArgonKeyLen  = 128
)

func HashPassword(password string) (string, error) {
	salt := make([]byte, argonSaltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)

	b64Salt := base64.RawStdEncoding.EncodeToString(salt)
	b64Hash := base64.RawStdEncoding.EncodeToString(hash)

	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version, argonMemory, argonTime, argonThreads, b64Salt, b64Hash), nil
}

func VerifyPassword(password, encodedHash string) (bool, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 {
		return false, ErrInvalidHash
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil {
		return false, ErrInvalidHash
	}
	if version != argon2.Version {
		return false, fmt.Errorf("auth: unsupported argon2 version %d", version)
	}

	var memory, iterations, parallelism int
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &iterations, &parallelism); err != nil {
		return false, ErrInvalidHash
	}
	// Bounds-check before casting so a malformed or maliciously inflated hash
	// can neither overflow the int->uint conversions nor drive an unbounded
	// argon2 run on the verify path.
	if memory < minArgonMemory || memory > maxArgonMemory ||
		iterations < 1 || iterations > maxArgonTime ||
		parallelism < 1 || parallelism > maxArgonThreads {
		return false, ErrUnsafeHash
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false, ErrInvalidHash
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return false, ErrInvalidHash
	}
	if len(salt) < minArgonSaltLen || len(expected) < minArgonKeyLen || len(expected) > maxArgonKeyLen {
		return false, ErrInvalidHash
	}

	// #nosec G115 -- iterations/memory/parallelism/keyLen are all bounds-checked
	// above, so the int->uint conversions cannot overflow.
	actual := argon2.IDKey([]byte(password), salt, uint32(iterations), uint32(memory), uint8(parallelism), uint32(len(expected)))

	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}
