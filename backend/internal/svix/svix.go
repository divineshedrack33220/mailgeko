// Package svix verifies Svix-style webhook signatures, the scheme used by
// Resend to sign every webhook delivery.
package svix

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"strconv"
	"strings"
	"time"
)

// Tolerance is how old a signed delivery may be before it is rejected as a
// replay. Resend/Svix delivers within a 5-minute window.
const Tolerance = 5 * time.Minute

// Verify checks the Svix signature for a webhook delivery: base64 HMAC-SHA256
// over "<id>.<timestamp>.<raw body>" keyed with the signing secret (whsec_...).
// The signature header may carry multiple space-separated values (v1,...), any
// one of which may match. The timestamp must be within Tolerance of now.
func Verify(rawBody []byte, secret, id, timestamp, signatureHeader string) bool {
	if secret == "" || id == "" || timestamp == "" || signatureHeader == "" {
		return false
	}

	unix, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil {
		return false
	}
	age := time.Since(time.Unix(unix, 0))
	if age < -Tolerance || age > Tolerance {
		return false
	}

	key := []byte(secret)
	if decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(secret, "whsec_")); err == nil && strings.HasPrefix(secret, "whsec_") {
		key = decoded
	}

	signed := []byte(id + "." + timestamp + ".")
	signed = append(signed, rawBody...)
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write(signed)
	want := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	for _, part := range strings.Split(signatureHeader, " ") {
		part = strings.TrimSpace(part)
		if !strings.HasPrefix(part, "v1,") {
			continue
		}
		if hmac.Equal([]byte(strings.TrimPrefix(part, "v1,")), []byte(want)) {
			return true
		}
	}
	return false
}
