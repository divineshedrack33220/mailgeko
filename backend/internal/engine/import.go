package engine

import (
	"context"
	"encoding/csv"
	"io"
	"os"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

var knownContactFields = map[string]bool{
	"email": true, "first_name": true, "firstname": true, "last_name": true, "lastname": true,
	"company": true, "position": true, "job_title": true, "country": true, "city": true,
	"phone": true, "phone_number": true, "phonenumber": true, "status": true, "tags": true,
}

func (e *Engine) ImportCSV(ctx context.Context, workspaceID, listID, path string) (imported, updated int64, err error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()
	defer os.Remove(path)

	reader := csv.NewReader(f)
	reader.FieldsPerRecord = -1

	header, err := reader.Read()
	if err != nil {
		return 0, 0, err
	}
	colIndex := make(map[string]int, len(header))
	for i, h := range header {
		colIndex[normalizeHeader(h)] = i
	}

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return imported, updated, err
		}

		get := func(names ...string) string {
			for _, n := range names {
				if i, ok := colIndex[normalizeHeader(n)]; ok && i < len(row) {
					return strings.TrimSpace(row[i])
				}
			}
			return ""
		}

		email := get("email")
		if email == "" {
			continue
		}

		custom := make(map[string]string)
		var tags []string
		for rawHeader, i := range colIndex {
			if knownContactFields[rawHeader] || i >= len(row) {
				continue
			}
			val := strings.TrimSpace(row[i])
			if val == "" {
				continue
			}
			if rawHeader == "tags" {
				tags = splitTags(val)
				continue
			}
			custom[rawHeader] = val
		}

		status := get("status")
		if status == "" {
			status = store.ContactActive
		}

		contact := &store.Contact{
			ID:           NewID(),
			WorkspaceID:  workspaceID,
			Email:        strings.ToLower(email),
			FirstName:    get("first_name", "firstname"),
			LastName:     get("last_name", "lastname"),
			Company:      get("company"),
			Position:     get("position", "job_title"),
			Country:      get("country"),
			City:         get("city"),
			PhoneNumber:  get("phone_number", "phone", "phonenumber"),
			CustomFields: custom,
			Tags:         tags,
			Status:       status,
		}

		existing, err := e.store.ContactByEmail(ctx, workspaceID, contact.Email)
		if err == nil {
			contact.ID = existing.ID
			if len(contact.CustomFields) == 0 {
				contact.CustomFields = existing.CustomFields
			}
			if len(contact.Tags) == 0 {
				contact.Tags = existing.Tags
			}
			if err := e.store.UpdateContact(ctx, contact); err != nil {
				return imported, updated, err
			}
			updated++
		} else if err := e.store.CreateContact(ctx, contact); err != nil {
			return imported, updated, err
		} else {
			imported++
			if err := e.EnrollWelcome(ctx, contact); err != nil {
				return imported, updated, err
			}
		}

		if listID != "" {
			_ = e.store.AddContactToList(ctx, listID, contact.ID)
		}
	}

	return imported, updated, nil
}

func normalizeHeader(h string) string {
	return strings.ToLower(strings.ReplaceAll(strings.TrimSpace(h), " ", "_"))
}

func splitTags(v string) []string {
	var out []string
	for _, part := range strings.Split(v, ",") {
		if t := strings.TrimSpace(part); t != "" {
			out = append(out, t)
		}
	}
	return out
}
