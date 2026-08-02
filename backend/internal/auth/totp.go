package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

// recoveryAlphabet avoids ambiguous characters (I, O, 0, 1).
const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// GenerateTOTPSecret creates a fresh TOTP secret and its otpauth:// URL.
func GenerateTOTPSecret(issuer, accountName string) (secret, otpauthURL string, err error) {
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: accountName,
		Period:      30,
		SecretSize:  20,
	})
	if err != nil {
		return "", "", err
	}
	return key.Secret(), key.URL(), nil
}

// ValidateTOTP checks a 6-digit code against a base32 secret, allowing a
// one-step skew on either side of the current 30-second window.
func ValidateTOTP(code, secret string) bool {
	ok, err := totp.ValidateCustom(code, secret, time.Now().UTC(), totp.ValidateOpts{
		Period:    30,
		Skew:      1,
		Digits:    otp.DigitsSix,
		Algorithm: otp.AlgorithmSHA1,
	})
	return err == nil && ok
}

// GenerateRecoveryCodes returns n single-use codes in xxxx-xxxx-xxxx form.
func GenerateRecoveryCodes(n int) ([]string, error) {
	codes := make([]string, n)
	for i := 0; i < n; i++ {
		raw := make([]byte, 12)
		if _, err := rand.Read(raw); err != nil {
			return nil, err
		}
		var sb strings.Builder
		for j := 0; j < 12; j++ {
			sb.WriteByte(recoveryAlphabet[int(raw[j])%len(recoveryAlphabet)])
			if j == 3 || j == 7 {
				sb.WriteByte('-')
			}
		}
		codes[i] = sb.String()
	}
	return codes, nil
}

// HashRecoveryCodes returns SHA-256 hex hashes of each code, ready to store.
func HashRecoveryCodes(codes []string) []string {
	hashes := make([]string, len(codes))
	for i, c := range codes {
		sum := sha256.Sum256([]byte(c))
		hashes[i] = hex.EncodeToString(sum[:])
	}
	return hashes
}

// NormalizeRecoveryCode upper-cases and trims a recovery code for comparison.
func NormalizeRecoveryCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

// ConsumeRecoveryCode checks a code against the stored hashes (JSON array) and,
// on a match, returns the hashes with the used code removed.
func ConsumeRecoveryCode(code, storedJSON string) (matched bool, remaining []string) {
	var hashes []string
	if err := json.Unmarshal([]byte(storedJSON), &hashes); err != nil {
		return false, nil
	}
	sum := sha256.Sum256([]byte(NormalizeRecoveryCode(code)))
	want := hex.EncodeToString(sum[:])
	remaining = make([]string, 0, len(hashes))
	for _, h := range hashes {
		if h == want {
			matched = true
			continue
		}
		remaining = append(remaining, h)
	}
	return matched, remaining
}
