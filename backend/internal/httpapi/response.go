package httpapi

import (
	"encoding/json"
	"net/http"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}

func writeOK(w http.ResponseWriter, v any) {
	writeJSON(w, http.StatusOK, v)
}

func orEmptySlice[T any](v []T) []T {
	if v == nil {
		return []T{}
	}
	return v
}

func orEmptyMap[K comparable, V any](v map[K]V) map[K]V {
	if v == nil {
		return map[K]V{}
	}
	return v
}

func orEmptyRaw(v json.RawMessage) json.RawMessage {
	if len(v) == 0 || string(v) == "null" {
		return json.RawMessage("[]")
	}
	return v
}
