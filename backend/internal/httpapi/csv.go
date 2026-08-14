package httpapi

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

const maxCSVUploadBytes = 64 << 20

func (s *Server) handleImportContacts(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxCSVUploadBytes)
	// #nosec G120 -- the body is capped at maxCSVUploadBytes (64 MiB) by the
	// MaxBytesReader above; the memory threshold below only bounds buffering.
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeError(w, http.StatusRequestEntityTooLarge, "too_large", "file is too large (max 64 MiB)")
			return
		}
		writeError(w, http.StatusBadRequest, "invalid_request", "expected multipart form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "file field is required")
		return
	}
	defer file.Close()

	listID := r.FormValue("listId")
	if listID != "" {
		if _, err := s.db.GetList(r.Context(), claims.GetWorkspaceID(), listID); err != nil {
			writeError(w, http.StatusUnprocessableEntity, "validation", "list does not exist in this workspace")
			return
		}
	}

	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not process import")
		return
	}
	path := filepath.Join(os.TempDir(), "mailgeko-import-"+hex.EncodeToString(buf)+".csv")
	// #nosec G304 -- path is server-generated (os.TempDir() + random hex), never
	// derived from request input; it points at a fresh file this handler owns.
	dst, err := os.Create(path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not store file")
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		_ = dst.Close()
		_ = os.Remove(path)
		writeError(w, http.StatusInternalServerError, "internal", "could not store file")
		return
	}
	_ = dst.Close()

	if s.biller != nil {
		if err := s.biller.CheckContactQuota(r.Context(), claims.GetWorkspaceID(), countCSVRows(path)); err != nil {
			_ = os.Remove(path)
			s.writePlanError(w, err)
			return
		}
	}

	importID := newID()
	payload := queueImportCSVPayload{
		ImportID:    importID,
		WorkspaceID: claims.GetWorkspaceID(),
		ListID:      listID,
		Path:        path,
	}
	if err := s.queue.EnqueueImportCSV(r.Context(), payload); err != nil {
		_ = os.Remove(path)
		writeError(w, http.StatusInternalServerError, "internal", "could not queue import")
		return
	}
	writeOK(w, map[string]any{"queued": true, "importId": importID})
}

func countCSVRows(path string) int64 {
	// #nosec G304 -- path is server-generated (os.TempDir() + random hex), never
	// derived from request input; it points at a file this handler just wrote.
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()
	r := csv.NewReader(f)
	r.FieldsPerRecord = -1
	var n int64
	for {
		rec, err := r.Read()
		if err != nil {
			break
		}
		if len(rec) > 0 && rec[0] != "" {
			n++
		}
	}
	return n
}
