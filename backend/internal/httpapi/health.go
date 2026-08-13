package httpapi

import (
	"context"
	"net/http"
	"time"
)

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
		"env":    s.cfg.Env,
	})
}

// handlePing answers with an empty 200 and no dependencies, so platform health
// checks (Render, etc.) can probe the API without touching Redis or the DB.
func (s *Server) handlePing(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

// handleReady reports whether the process can serve traffic. Each configured
// backing dependency (TiDB, queue/Redis, optional Postgres analytics) is pinged
// with a short timeout; the endpoint returns 200 only when all are reachable and
// 503 listing the failing components otherwise. Use this for orchestrators
// (Kubernetes, load balancers) — not for platform liveness probes, which should
// keep hitting /ping so transient blips don't restart the container.
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	status := http.StatusOK
	checks := make(map[string]string, len(s.readyChecks))
	for _, c := range s.readyChecks {
		if err := c.ping.Ping(ctx); err != nil {
			status = http.StatusServiceUnavailable
			checks[c.name] = "down"
			s.logger.Error("readiness check failed", "dependency", c.name, "error", err)
			continue
		}
		checks[c.name] = "up"
	}

	if status != http.StatusOK {
		writeJSON(w, status, map[string]any{"status": "unhealthy", "checks": checks})
		return
	}
	writeJSON(w, status, map[string]any{"status": "ok", "checks": checks})
}
