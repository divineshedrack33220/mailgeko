package httpapi

import (
	"crypto/rand"
	"encoding/csv"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
)

func (s *Server) handleImportContacts(w http.ResponseWriter, r *http.Request) {
	claims := claimsFrom(r)
	if !s.requireMemberRole(w, r, "owner", "admin", "manager") {
		return
	}
	if err := r.ParseMultipartForm(20 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "expected multipart form")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "file field is required")
		return
	}
	defer file.Close()

	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not process import")
		return
	}
	path := filepath.Join(os.TempDir(), "mailgeko-import-"+hex.EncodeToString(buf)+".csv")
	dst, err := os.Create(path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", "could not store file")
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		os.Remove(path)
		writeError(w, http.StatusInternalServerError, "internal", "could not store file")
		return
	}
	dst.Close()

	if s.biller != nil {
		if err := s.biller.CheckContactQuota(r.Context(), claims.GetWorkspaceID(), countCSVRows(path)); err != nil {
			os.Remove(path)
			s.writePlanError(w, err)
			return
		}
	}

	importID := newID()
	payload := queueImportCSVPayload{
		ImportID:    importID,
		WorkspaceID: claims.GetWorkspaceID(),
		ListID:      r.FormValue("listId"),
		Path:        path,
	}
	if err := s.queue.EnqueueImportCSV(r.Context(), payload); err != nil {
		os.Remove(path)
		writeError(w, http.StatusInternalServerError, "internal", "could not queue import")
		return
	}
	writeOK(w, map[string]any{"queued": true, "importId": importID})
}

func countCSVRows(path string) int64 {
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
