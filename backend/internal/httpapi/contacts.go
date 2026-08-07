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
	Email        *string           `json:"email"`
	FirstName    *string           `json:"firstName"`
	LastName     *string           `json:"lastName"`
	Company      *string           `json:"company"`
	Position     *string           `json:"position"`
	Country      *string           `json:"country"`
	City         *string           `json:"city"`
	PhoneNumber  *string           `json:"phoneNumber"`
	CustomFields map[string]string `json:"customFields"`
	Tags         []string          `json:"tags"`
	Status       *string           `json:"status"`
	ListIDs      []string          `json:"listIds"`
}

// applyTo merges the request's present fields onto c. For PATCH semantics a
// field that is present (even as "") overwrites c; a field that is absent
// (nil) leaves c untouched.
func (r *contactRequest) applyTo(c *store.Contact) {
	if r.Email != nil {
		c.Email = strings.ToLower(strings.TrimSpace(*r.Email))
	}
	if r.FirstName != nil {
		c.FirstName = *r.FirstName
	}
	if r.LastName != nil {
		c.LastName = *r.LastName
	}
	if r.Company != nil {
		c.Company = *r.Company
	}
	if r.Position != nil {
		c.Position = *r.Position
	}
	if r.Country != nil {
		c.Country = *r.Country
	}
	if r.City != nil {
		c.City = *r.City
	}
	if r.PhoneNumber != nil {
		c.PhoneNumber = *r.PhoneNumber
	}
	if r.Status != nil {
		c.Status = *r.Status
	}
	if r.CustomFields != nil {
		c.CustomFields = r.CustomFields
	}
	if r.Tags != nil {
		c.Tags = r.Tags
	}
}

func (r *contactRequest) toContact(wsID, id string) *store.Contact {
	c := &store.Contact{
		ID:          id,
		WorkspaceID: wsID,
	}
	r.applyTo(c)
	if c.Status == "" {
		c.Status = store.ContactActive
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
		"customFields":     orEmptyMap(c.CustomFields),
		"tags":             orEmptySlice(c.Tags),
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
		ListID: query.Get("listId"),
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

	count, _ := s.db.CountContacts(r.Context(), claims.GetWorkspaceID())

	out := make([]map[string]any, 0, len(contacts))
	for _, c := range contacts {
		out = append(out, contactResponse(c))
	}
	writeOK(w, map[string]any{"contacts": out, "total": count})
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

type oneToOneEmailRequest struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

func (s *Server) handleSendOneToOne(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	contact, err := s.db.GetContact(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "contact not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load contact")
		return
	}
	if contact.Status == store.ContactUnsubscribed {
		writeError(w, http.StatusUnprocessableEntity, "unsubscribed", "this contact has unsubscribed")
		return
	}

	var req oneToOneEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Subject) == "" || strings.TrimSpace(req.Body) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "subject and body are required")
		return
	}

	ws, err := s.db.GetWorkspace(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load workspace")
		return
	}
	if s.engine == nil {
		writeError(w, http.StatusBadGateway, "not_configured", "email sending is not configured")
		return
	}

	result, err := s.engine.SendOneToOne(r.Context(), ws, contact, req.Subject, req.Body)
	if err != nil {
		writeError(w, http.StatusBadGateway, "send_failed", "could not send email: "+err.Error())
		return
	}
	writeOK(w, map[string]any{"messageId": result.MessageID})
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
	updated := *existing
	req.applyTo(&updated)
	if strings.TrimSpace(updated.Email) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "email is required")
		return
	}

	if err := s.db.UpdateContact(r.Context(), &updated); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update contact")
		return
	}
	s.maybeEnqueueEmbed(r, claims.GetWorkspaceID(), id)
	writeOK(w, map[string]any{"contact": contactResponse(&updated)})
}

func (s *Server) handleDeleteContact(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.DeleteContact(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete contact")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleListTags(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	tags, err := s.db.TagCounts(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load tags")
		return
	}
	writeOK(w, map[string]any{"tags": tags})
}

func (s *Server) handleBulkTagContacts(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	var req struct {
		ContactIDs []string `json:"contactIds"`
		Tags       []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if len(req.ContactIDs) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "validation", "contactIds is required")
		return
	}
	clean := make([]string, 0, len(req.Tags))
	seen := make(map[string]struct{})
	for _, t := range req.Tags {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		if _, ok := seen[t]; ok {
			continue
		}
		seen[t] = struct{}{}
		clean = append(clean, t)
	}

	contacts, err := s.db.ContactsByIDs(r.Context(), claims.GetWorkspaceID(), req.ContactIDs)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not load contacts")
		return
	}
	for _, c := range contacts {
		have := make(map[string]struct{}, len(c.Tags)+len(clean))
		for _, t := range c.Tags {
			have[t] = struct{}{}
		}
		merged := append([]string{}, c.Tags...)
		for _, t := range clean {
			if _, ok := have[t]; !ok {
				have[t] = struct{}{}
				merged = append(merged, t)
			}
		}
		c.Tags = merged
		if err := s.db.UpdateContact(r.Context(), c); err != nil {
			writeError(w, http.StatusInternalServerError, "internal", "could not update contacts")
			return
		}
	}
	writeOK(w, map[string]any{"updated": len(contacts)})
}
