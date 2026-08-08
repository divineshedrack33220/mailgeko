package httpapi

import (
	"database/sql"
	"net/http"
)

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "not authenticated")
		return
	}

	user, err := s.db.UserByID(r.Context(), claims.GetUserID())
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "not_found", "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}

	if _, err := s.db.WorkspaceMemberByUserID(r.Context(), claims.GetWorkspaceID(), claims.GetUserID()); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusForbidden, "forbidden", "you are not a member of this workspace")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal", "could not load profile")
		return
	}

	writeOK(w, map[string]any{
		"user":        userResponse(user),
		"workspaceID": claims.GetWorkspaceID(),
	})
}
