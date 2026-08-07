package httpapi

import (
	"net/http"

	"github.com/divineshedrack33220/mailgeko/backend/internal/cloudinary"
)

func (s *Server) handleUploadAvatar(w http.ResponseWriter, r *http.Request) {
	if s.uploads == nil || !s.uploads.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "not_configured", "image uploads are not configured")
		return
	}
	claims := claimsFrom(r)
	url, err := s.uploadImage(r, "avatars")
	if err != nil {
		writeError(w, http.StatusBadRequest, "upload_failed", err.Error())
		return
	}
	if err := s.db.UpdateUserAvatar(r.Context(), claims.GetUserID(), url); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not save avatar")
		return
	}
	writeOK(w, map[string]any{"avatarUrl": url})
}

func (s *Server) handleUploadLogo(w http.ResponseWriter, r *http.Request) {
	if s.uploads == nil || !s.uploads.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "not_configured", "image uploads are not configured")
		return
	}
	if !s.requireMemberRole(w, r, "owner", "admin") {
		return
	}
	claims := claimsFrom(r)
	url, err := s.uploadImage(r, "logos")
	if err != nil {
		writeError(w, http.StatusBadRequest, "upload_failed", err.Error())
		return
	}
	if err := s.db.UpdateWorkspaceLogo(r.Context(), claims.GetWorkspaceID(), url); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not save logo")
		return
	}
	writeOK(w, map[string]any{"logoUrl": url})
}

func (s *Server) uploadImage(r *http.Request, folder string) (string, error) {
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		return "", err
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		return "", err
	}
	defer file.Close()

	client := cloudinary.New(s.uploads.CloudName, s.uploads.APIKey, s.uploads.APISecret, folder)
	return client.Upload(file, "upload")
}
