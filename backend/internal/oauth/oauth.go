package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

type Provider string

const (
	Google Provider = "google"
	GitHub Provider = "github"
)

// Identity is the profile returned by the OAuth provider after exchange.
type Identity struct {
	Provider    Provider
	ProviderUID string
	Email       string
	Name        string
}

type Manager struct {
	configs map[Provider]*oauth2.Config
}

func NewManager(baseURL, googleID, googleSecret, githubID, githubSecret string) *Manager {
	m := &Manager{
		configs: map[Provider]*oauth2.Config{},
	}
	if googleID != "" && googleSecret != "" {
		m.configs[Google] = &oauth2.Config{
			ClientID:     googleID,
			ClientSecret: googleSecret,
			RedirectURL:  baseURL + "/api/v1/auth/oauth/google/callback",
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}
	if githubID != "" && githubSecret != "" {
		m.configs[GitHub] = &oauth2.Config{
			ClientID:     githubID,
			ClientSecret: githubSecret,
			RedirectURL:  baseURL + "/api/v1/auth/oauth/github/callback",
			Scopes:       []string{"read:user", "user:email"},
			Endpoint:     github.Endpoint,
		}
	}
	return m
}

func (m *Manager) Enabled(p Provider) bool {
	_, ok := m.configs[p]
	return ok
}

func (m *Manager) AuthCodeURL(p Provider, state string) (string, error) {
	c, ok := m.configs[p]
	if !ok {
		return "", fmt.Errorf("oauth provider %q is not configured", p)
	}
	return c.AuthCodeURL(state, oauth2.AccessTypeOnline), nil
}

func (m *Manager) Exchange(ctx context.Context, p Provider, code string) (*oauth2.Token, error) {
	c, ok := m.configs[p]
	if !ok {
		return nil, fmt.Errorf("oauth provider %q is not configured", p)
	}
	return c.Exchange(ctx, code)
}

// FetchIdentity resolves the profile for an exchanged token. For GitHub the
// primary verified email is fetched when the public profile email is absent.
func (m *Manager) FetchIdentity(ctx context.Context, p Provider, token *oauth2.Token) (*Identity, error) {
	c, ok := m.configs[p]
	if !ok {
		return nil, fmt.Errorf("oauth provider %q is not configured", p)
	}
	client := c.Client(ctx, token)

	switch p {
	case Google:
		return m.fetchGoogle(client)
	case GitHub:
		return m.fetchGitHub(ctx, client)
	default:
		return nil, fmt.Errorf("unsupported provider %q", p)
	}
}

func (m *Manager) fetchGoogle(client *http.Client) (*Identity, error) {
	resp, err := client.Get("https://openidconnect.googleapis.com/v1/userinfo")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google userinfo: status %d", resp.StatusCode)
	}
	var info struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	if info.Sub == "" || info.Email == "" {
		return nil, fmt.Errorf("google profile missing sub or email")
	}
	return &Identity{Provider: Google, ProviderUID: info.Sub, Email: info.Email, Name: info.Name}, nil
}

func (m *Manager) fetchGitHub(ctx context.Context, client *http.Client) (*Identity, error) {
	resp, err := client.Get("https://api.github.com/user")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("github user: status %d", resp.StatusCode)
	}
	var user struct {
		ID    int64  `json:"id"`
		Login string `json:"login"`
		Name  string `json:"name"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}
	if user.ID == 0 {
		return nil, fmt.Errorf("github profile missing id")
	}

	email := user.Email
	if email == "" {
		email = m.githubPrimaryEmail(ctx, client)
	}
	if email == "" {
		return nil, fmt.Errorf("github account has no accessible email; make an email public in your GitHub settings")
	}

	name := user.Name
	if name == "" {
		name = user.Login
	}
	return &Identity{
		Provider:    GitHub,
		ProviderUID: fmt.Sprintf("%d", user.ID),
		Email:       email,
		Name:        name,
	}, nil
}

func (m *Manager) githubPrimaryEmail(ctx context.Context, client *http.Client) string {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://api.github.com/user/emails", nil)
	if err != nil {
		return ""
	}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var emails []struct {
		Email    string `json:"email"`
		Primary  bool   `json:"primary"`
		Verified bool   `json:"verified"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&emails); err != nil {
		return ""
	}
	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email
		}
	}
	for _, e := range emails {
		if e.Verified {
			return e.Email
		}
	}
	return ""
}
