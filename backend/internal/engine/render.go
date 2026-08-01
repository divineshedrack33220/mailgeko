package engine

import (
	"net/url"
	"regexp"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

var hrefRegex = regexp.MustCompile(`(?i)href=["']([^"']+)["']`)

type RenderOptions struct {
	BaseURL          string
	TrackOpens       bool
	TrackClicks      bool
	AllowUnsubscribe bool
	CampaignID       string
	ContactID        string
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

func RenderHTML(htmlContent string, vars map[string]string, opts RenderOptions) string {
	out := Substitute(htmlContent, vars)

	if opts.TrackClicks {
		out = hrefRegex.ReplaceAllStringFunc(out, func(m string) string {
			inner := m[6 : len(m)-1]
			u, err := url.Parse(inner)
			if err != nil || u.Scheme == "" {
				return m
			}
			target := opts.BaseURL + "/track/click?c=" + opts.CampaignID + "&m=" + opts.ContactID +
				"&u=" + url.QueryEscape(inner)
			return `href="` + target + `"`
		})
	}

	if opts.TrackOpens {
		pixel := `<img src="` + opts.BaseURL + `/track/open?c=` + opts.CampaignID +
			`&m=` + opts.ContactID + `" width="1" height="1" style="display:none" alt="" />`
		out = strings.Replace(out, "</body>", pixel+"</body>", 1)
		if !strings.Contains(out, pixel) {
			out += pixel
		}
	}

	if opts.AllowUnsubscribe {
		link := opts.BaseURL + "/track/unsubscribe?c=" + opts.CampaignID + "&m=" + opts.ContactID
		label := `<a href="` + link + `">Unsubscribe</a>`
		out = strings.Replace(out, "</body>", label+"</body>", 1)
		if !strings.Contains(out, label) {
			out += label
		}
	}

	return out
}
