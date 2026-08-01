package httpapi

import (
	"net/http"
	"strconv"
	"time"

	"github.com/divineshedrack33220/mailgeko/backend/internal/store"
)

func notificationResponse(n store.Notification) map[string]any {
	var readAt any
	if n.ReadAt != nil {
		readAt = n.ReadAt.UTC().Format(time.RFC3339)
	}
	return map[string]any{
		"id":        n.ID,
		"type":      n.Type,
		"title":     n.Title,
		"body":      n.Body,
		"link":      n.Link,
		"read":      n.ReadAt != nil,
		"readAt":    readAt,
		"createdAt": n.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func (s *Server) handleListNotifications(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	limit := 20
	if raw := r.URL.Query().Get("limit"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			limit = v
		}
	}
	items, err := s.db.ListNotifications(r.Context(), claims.GetWorkspaceID(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not list notifications")
		return
	}
	unread, err := s.db.UnreadNotificationCount(r.Context(), claims.GetWorkspaceID())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not count notifications")
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, n := range items {
		out = append(out, notificationResponse(n))
	}
	writeOK(w, map[string]any{"notifications": out, "unread": unread})
}

func (s *Server) handleMarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.MarkNotificationRead(r.Context(), claims.GetWorkspaceID(), r.PathValue("id")); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update notification")
		return
	}
	writeOK(w, map[string]any{"ok": true})
}

func (s *Server) handleReadAllNotifications(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if err := s.db.MarkAllNotificationsRead(r.Context(), claims.GetWorkspaceID()); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not update notifications")
		return
	}
	writeOK(w, map[string]any{"ok": true})
}
