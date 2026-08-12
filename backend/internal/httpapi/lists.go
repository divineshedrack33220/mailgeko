package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

type listRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	ContactIDs  []string `json:"contactIds"`
	Emails      []string `json:"emails"`
}

func listResponse(l *store.List, contactCount int64) map[string]any {
	return map[string]any{
		"id":           l.ID,
		"name":         l.Name,
		"description":  l.Description,
		"contactCount": contactCount,
		"createdAt":    l.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Server) handleListLists(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	lists, err := s.db.ListListsWithCounts(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list lists")
		return
	}
	out := make([]map[string]any, 0, len(lists))
	for _, l := range lists {
		out = append(out, listResponse(&l.List, l.ContactCount))
	}
	writeOK(w, map[string]any{"lists": out})
}

func (s *Server) handleCreateList(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	var req listRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusUnprocessableEntity, "validation", "name is required")
		return
	}
	l := &store.List{ID: newID(), WorkspaceID: claims.GetWorkspaceID(), Name: req.Name, Description: req.Description, CreatedAt: time.Now()}
	if err := s.db.CreateList(r.Context(), l); err != nil {
		var mysqlErr *mysql.MySQLError
		if errors.As(err, &mysqlErr) && mysqlErr.Number == 1062 {
			writeError(w, http.StatusConflict, "duplicate", "a list with this name already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not create list")
		return
	}
	added := 0
	for _, id := range req.ContactIDs {
		if _, err := s.db.GetContact(r.Context(), claims.GetWorkspaceID(), id); err != nil {
			continue
		}
		if err := s.db.AddContactToList(r.Context(), l.ID, id); err == nil {
			added++
		}
	}
	for _, email := range req.Emails {
		contact, err := s.db.ContactByEmail(r.Context(), claims.GetWorkspaceID(), email)
		if err != nil {
			continue
		}
		if err := s.db.AddContactToList(r.Context(), l.ID, contact.ID); err == nil {
			added++
		}
	}
	count, _ := s.db.ListContactCount(r.Context(), claims.GetWorkspaceID(), l.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"list": listResponse(l, count), "added": added})
}

func (s *Server) handleGetList(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	l, err := s.db.GetList(r.Context(), claims.GetWorkspaceID(), r.PathValue("id"))
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "list not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load list")
		return
	}
	count, _ := s.db.ListContactCount(r.Context(), claims.GetWorkspaceID(), l.ID)
	writeOK(w, map[string]any{"list": listResponse(l, count)})
}

func (s *Server) handleUpdateList(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	id := r.PathValue("id")
	if _, err := s.db.GetList(r.Context(), claims.GetWorkspaceID(), id); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "list not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load list")
		return
	}
	var req listRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}
	l := &store.List{ID: id, WorkspaceID: claims.GetWorkspaceID(), Name: req.Name, Description: req.Description}
	if err := s.db.UpdateList(r.Context(), l); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update list")
		return
	}
	writeOK(w, map[string]any{"list": listResponse(l, 0)})
}

func (s *Server) handleDeleteList(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	if err := s.db.DeleteList(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not delete list")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}

func (s *Server) handleAddContactsToList(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	listID := r.PathValue("id")
	if _, err := s.db.GetList(r.Context(), claims.GetWorkspaceID(), listID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "list not found")
		return
	}
	var req struct {
		ContactIDs []string `json:"contactIds"`
		Emails     []string `json:"emails"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "invalid JSON body")
		return
	}

	added := 0
	for _, id := range req.ContactIDs {
		if _, err := s.db.GetContact(r.Context(), claims.GetWorkspaceID(), id); err != nil {
			continue
		}
		if err := s.db.AddContactToList(r.Context(), listID, id); err == nil {
			added++
		}
	}
	for _, email := range req.Emails {
		contact, err := s.db.ContactByEmail(r.Context(), claims.GetWorkspaceID(), email)
		if err != nil {
			continue
		}
		if err := s.db.AddContactToList(r.Context(), listID, contact.ID); err == nil {
			added++
		}
	}
	writeOK(w, map[string]any{"added": added})
}

func (s *Server) handleRemoveContactFromList(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	listID := r.PathValue("id")
	if _, err := s.db.GetList(r.Context(), claims.GetWorkspaceID(), listID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "list not found")
		return
	}
	contactID := r.PathValue("contactId")
	if _, err := s.db.GetContact(r.Context(), claims.GetWorkspaceID(), contactID); err != nil {
		writeError(w, http.StatusNotFound, "not_found", "contact not found")
		return
	}
	if err := s.db.RemoveContactFromList(r.Context(), listID, contactID); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not remove contact")
		return
	}
	writeOK(w, map[string]bool{"ok": true})
}
