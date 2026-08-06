package engine

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
	"github.com/divineshedrack33220/mailgeko/backend/internal/track"
)

var hrefRegex = regexp.MustCompile(`(?i)href=["']([^"']+)["']`)

type RenderOptions struct {
	BaseURL          string
	TrackOpens       bool
	TrackClicks      bool
	AllowUnsubscribe bool
	CampaignID       string
	ContactID        string
	// SigningKey, when non-empty, signs each tracking URL so forged links are
	// rejected.
	SigningKey string
}

func contactVariables(c *store.Contact) map[string]string {
	vars := map[string]string{
		"first_name": c.FirstName,
		"last_name":  c.LastName,
		"email":      c.Email,
		"company":    c.Company,
		"position":   c.Position,
		"country":    c.Country,
		"city":       c.City,
		"phone":      c.PhoneNumber,
	}
	for k, val := range c.CustomFields {
		vars[k] = val
	}
	return vars
}

func Substitute(content string, vars map[string]string) string {
	if !strings.Contains(content, "{") {
		return content
	}
	pairs := make([]string, 0, len(vars)*4)
	for k, v := range vars {
		pairs = append(pairs, "{{"+k+"}}", v)
		pairs = append(pairs, "{"+k+"}", v)
	}
	return strings.NewReplacer(pairs...).Replace(content)
}

// trackURL builds a signed tracking URL for the given kind and optional
// target. The signature covers the raw (unescaped) target so verification can
// reproduce it after URL-decoding.
func trackURL(opts RenderOptions, kind, target string) string {
	q := url.Values{}
	q.Set("c", opts.CampaignID)
	q.Set("m", opts.ContactID)
	if target != "" {
		q.Set("u", target)
	}
	if opts.SigningKey != "" {
		q.Set("s", track.Sign(opts.SigningKey, kind, opts.CampaignID, opts.ContactID, target))
	}
	return opts.BaseURL + "/track/" + kind + "?" + q.Encode()
}

// UnsubscribeURL returns the signed one-click unsubscribe URL for the
// campaign/contact, or "" when unsubscribing is disabled for the send.
func UnsubscribeURL(opts RenderOptions) string {
	if !opts.AllowUnsubscribe {
		return ""
	}
	return trackURL(opts, "unsubscribe", "")
}

func RenderHTML(htmlContent string, vars map[string]string, opts RenderOptions) string {
	out := Substitute(htmlContent, vars)

	if opts.TrackClicks {
		out = hrefRegex.ReplaceAllStringFunc(out, func(m string) string {
			inner := m[6 : len(m)-1]
			u, err := url.Parse(inner)
			if err != nil || u.Scheme == "" {
				return m
			}
			return `href="` + trackURL(opts, "click", inner) + `"`
		})
	}

	if opts.TrackOpens {
		pixel := `<img src="` + trackURL(opts, "open", "") + `" width="1" height="1" style="display:none" alt="" />`
		out = strings.Replace(out, "</body>", pixel+"</body>", 1)
		if !strings.Contains(out, pixel) {
			out += pixel
		}
	}

	if opts.AllowUnsubscribe {
		link := trackURL(opts, "unsubscribe", "")
		label := `<a href="` + link + `">Unsubscribe</a>`
		out = strings.Replace(out, "</body>", label+"</body>", 1)
		if !strings.Contains(out, label) {
			out += label
		}
	}

	return out
}
