package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type contactRequest struct {
	Email        string            `json:"email"`
	FirstName    string            `json:"firstName"`
	LastName     string            `json:"lastName"`
	Company      string            `json:"company"`
	Position     string            `json:"position"`
	Country      string            `json:"country"`
	City         string            `json:"city"`
	PhoneNumber  string            `json:"phoneNumber"`
	CustomFields map[string]string `json:"customFields"`
	Tags         []string          `json:"tags"`
	Status       string            `json:"status"`
	ListIDs      []string          `json:"listIds"`
}

func (r *contactRequest) toContact(wsID, id string) *store.Contact {
	status := r.Status
	if status == "" {
		status = store.ContactActive
	}
	c := &store.Contact{
		ID:           id,
		WorkspaceID:  wsID,
		Email:        strings.ToLower(strings.TrimSpace(r.Email)),
		FirstName:    r.FirstName,
		LastName:     r.LastName,
		Company:      r.Company,
		Position:     r.Position,
		Country:      r.Country,
		City:         r.City,
		PhoneNumber:  r.PhoneNumber,
		CustomFields: r.CustomFields,
		Tags:         r.Tags,
		Status:       status,
	}
	if c.Email == "" {
		return nil
	}
	return c
}

func contactResponse(c *store.Contact) map[string]any {
	out := map[string]any{
		"id":               c.ID,
		"email":            c.Email,
		"firstName":        c.FirstName,
		"lastName":         c.LastName,
		"company":          c.Company,
		"position":         c.Position,
		"country":          c.Country,
		"city":             c.City,
		"phoneNumber":      c.PhoneNumber,
		"customFields":     c.CustomFields,
		"tags":             c.Tags,
		"status":           c.Status,
		"createdAt":        c.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt":        c.UpdatedAt.UTC().Format(time.RFC3339),
		"lastEngagementAt": nil,
	}
	if c.LastEngagementAt != nil {
		out["lastEngagementAt"] = c.LastEngagementAt.UTC().Format(time.RFC3339)
	}
	return out
}

func (s *Server) handleListContacts(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	query := r.URL.Query()
	filter := store.ContactFilter{
		Query:  query.Get("q"),
		Status: query.Get("status"),
	}
	if v := query.Get("limit"); v != "" {
		filter.Limit, _ = strconv.Atoi(v)
	}
	if v := query.Get("offset"); v != "" {
		filter.Offset, _ = strconv.Atoi(v)
	}

	contacts, err := s.db.ListContacts(r.Context(), claims.GetWorkspaceID(), filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list contacts")
		return
	}

	out := make([]map[string]any, 0, len(contacts))
	for _, c := range contacts {
		out = append(out, contactResponse(c))
	}
	writeOK(w, map[string]any{"contacts": out})
}

func (s *Server) handleCreateContact(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req contactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	c := req.toContact(claims.GetWorkspaceID(), newID())
	if c == nil {
		writeError(w, http.StatusUnprocessableEntity, "validation", "email is required")
		return
	}

	if s.biller != nil {
		if err := s.biller.CheckContactQuota(r.Context(), claims.GetWorkspaceID(), 1); err != nil {
			s.writePlanError(w, err)
			return
		}
	}

	if err := s.db.CreateContact(r.Context(), c); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			writeError(w, http.StatusConflict, "duplicate", "a contact with this email already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not create contact")
		return
	}
	for _, listID := range req.ListIDs {
		_ = s.db.AddContactToList(r.Context(), listID, c.ID)
	}
	s.maybeEnqueueEmbed(r, claims.GetWorkspaceID(), c.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"contact": contactResponse(c)})
}

func (s *Server) handleGetContact(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	c, err := s.db.GetContact(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "contact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load contact")
		return
	}
	writeOK(w, map[string]any{"contact": contactResponse(c)})
}

func (s *Server) handleUpdateContact(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	id := r.PathValue("id")
	existing, err := s.db.GetContact(r.Context(), claims.GetWorkspaceID(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "contact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load contact")
		return
	}

	var req contactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	updated := req.toContact(claims.GetWorkspaceID(), id)
	if updated == nil {
		writeError(w, http.StatusUnprocessableEntity, "validation", "email is required")
		return
	}
	updated.ID = existing.ID
	updated.CreatedAt = existing.CreatedAt
	if updated.CustomFields == nil {
		updated.CustomFields = existing.CustomFields
	}
	if updated.Tags == nil {
		updated.Tags = existing.Tags
	}

	if err := s.db.UpdateContact(r.Context(), updated); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update contact")
		return
	}
	s.maybeEnqueueEmbed(r, claims.GetWorkspaceID(), id)
	writeOK(w, map[string]any{"contact": contactResponse(updated)})
}

func (s *Server) handleDeleteContact(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.DeleteContact(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete contact")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}
