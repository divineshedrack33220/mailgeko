package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var ErrInvalidClaims = errors.New("auth: invalid token claims")

type Claims struct {
	UserID      string   `json:"uid"`
	Email       string   `json:"email"`
	WorkspaceID string   `json:"wid"`
	Role        string   `json:"role"`
	Scopes      []string `json:"scopes,omitempty"`
	Pending     bool     `json:"pending,omitempty"`
	jwt.RegisteredClaims
}

func (c *Claims) GetUserID() string      { return c.UserID }
func (c *Claims) GetEmail() string       { return c.Email }
func (c *Claims) GetWorkspaceID() string { return c.WorkspaceID }
func (c *Claims) GetRole() string        { return c.Role }
func (c *Claims) GetTokenID() string     { return c.ID }

// pendingTwoFactorTTL bounds the lifetime of the short-lived token that is
// exchanged for a real session after a second-factor challenge.
const pendingTwoFactorTTL = 10 * time.Minute

type TokenManager struct {
	secret []byte
	ttl    time.Duration
	issuer string
}

func NewTokenManager(secret string, ttl time.Duration) *TokenManager {
	return &TokenManager{
		secret: []byte(secret),
		ttl:    ttl,
		issuer: "mailgeko",
	}
}

func (m *TokenManager) Issue(userID, email, workspaceID, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:      userID,
		Email:       email,
		WorkspaceID: workspaceID,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
			ID:        uuid.NewString(),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

func (m *TokenManager) Parse(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("auth: unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidClaims
	}
	return claims, nil
}

// IssuePendingTwoFactor issues a short-lived token that is only valid for
// completing the second-factor step of a login. It carries no workspace or
// role and is rejected by withAuth.
func (m *TokenManager) IssuePendingTwoFactor(userID, email string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:  userID,
		Email:   email,
		Pending: true,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(pendingTwoFactorTTL)),
			ID:        uuid.NewString(),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}
