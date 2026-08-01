package engine

import (
	"context"
	"errors"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
	"github.com/divineshedrack33220/mailgeko/backend/internal/vector"
)

var ErrEmbeddingNotConfigured = errors.New("vector search is not configured")

type SearchResult struct {
	Contact *store.Contact
	Score   float64
}

func contactText(c *store.Contact) string {
	var b strings.Builder
	write := func(label, value string) {
		if v := strings.TrimSpace(value); v != "" {
			if b.Len() > 0 {
				b.WriteString(". ")
			}
			b.WriteString(label)
			b.WriteString(": ")
			b.WriteString(v)
		}
	}
	write("Name", strings.TrimSpace(c.FirstName+" "+c.LastName))
	write("Company", c.Company)
	write("Position", c.Position)
	write("Country", c.Country)
	write("City", c.City)
	write("Industry", c.CustomFields["industry"])
	write("Plan", c.CustomFields["plan"])
	if len(c.Tags) > 0 {
		write("Tags", strings.Join(c.Tags, ", "))
	}
	if b.Len() == 0 {
		b.WriteString(c.Email)
	}
	return b.String()
}

func (e *Engine) EmbeddingEnabled() bool {
	return e.embedder != nil && e.embeds != nil
}

func (e *Engine) EmbedContact(ctx context.Context, workspaceID, contactID string) error {
	if !e.EmbeddingEnabled() {
		return ErrEmbeddingNotConfigured
	}
	c, err := e.store.GetContact(ctx, workspaceID, contactID)
	if err != nil {
		return err
	}
	vecs, err := e.embedder.Embed(ctx, []string{contactText(c)})
	if err != nil {
		return err
	}
	return e.embeds.Upsert(ctx, workspaceID, contactID, vecs[0])
}

func (e *Engine) EmbedWorkspace(ctx context.Context, workspaceID string) error {
	if !e.EmbeddingEnabled() {
		return ErrEmbeddingNotConfigured
	}
	contacts, err := e.store.ListContacts(ctx, workspaceID, store.ContactFilter{Limit: 500})
	if err != nil {
		return err
	}
	if len(contacts) == 0 {
		return nil
	}

	texts := make([]string, len(contacts))
	for i, c := range contacts {
		texts[i] = contactText(c)
	}
	vecs, err := e.embedder.Embed(ctx, texts)
	if err != nil {
		return err
	}
	for i, c := range contacts {
		if i < len(vecs) {
			if err := e.embeds.Upsert(ctx, workspaceID, c.ID, vecs[i]); err != nil {
				return err
			}
		}
	}
	return nil
}

// SearchContacts embeds the query text and returns the closest contacts.
func (e *Engine) SearchContacts(ctx context.Context, workspaceID, query string, limit int) ([]SearchResult, error) {
	if !e.EmbeddingEnabled() {
		return nil, ErrEmbeddingNotConfigured
	}
	if strings.TrimSpace(query) == "" {
		return nil, errors.New("query is required")
	}
	vecs, err := e.embedder.Embed(ctx, []string{query})
	if err != nil {
		return nil, err
	}
	hits, err := e.embeds.SearchByVector(ctx, workspaceID, vecs[0], limit)
	return e.resolveHits(ctx, workspaceID, hits, err)
}

func (e *Engine) SimilarContacts(ctx context.Context, workspaceID, contactID string, limit int) ([]SearchResult, error) {
	if !e.EmbeddingEnabled() {
		return nil, ErrEmbeddingNotConfigured
	}
	hits, err := e.embeds.SearchSimilar(ctx, workspaceID, contactID, limit)
	return e.resolveHits(ctx, workspaceID, hits, err)
}

func (e *Engine) resolveHits(ctx context.Context, workspaceID string, hits []vector.Hit, err error) ([]SearchResult, error) {
	if err != nil {
		return nil, err
	}
	if len(hits) == 0 {
		return nil, nil
	}
	ids := make([]string, len(hits))
	for i, h := range hits {
		ids[i] = h.ContactID
	}
	contacts, err := e.store.ContactsByIDs(ctx, workspaceID, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]*store.Contact, len(contacts))
	for _, c := range contacts {
		byID[c.ID] = c
	}

	out := make([]SearchResult, 0, len(hits))
	for _, h := range hits {
		if c := byID[h.ContactID]; c != nil {
			out = append(out, SearchResult{Contact: c, Score: h.Score})
		}
	}
	return out, nil
}
