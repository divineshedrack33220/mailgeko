package httpapi

import (
	"net"
	"net/http"
	"net/url"
	"strings"

	"github.com/divineshedrack33220/mailgeko/backend/internal/analytics"
)

var transparentPixel = []byte{
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
	0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21,
	0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00,
	0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
	0x44, 0x01, 0x00, 0x3b,
}

func trackParams(r *http.Request) (campaignID, contactID, workspaceID string) {
	return r.URL.Query().Get("c"), r.URL.Query().Get("m"), r.URL.Query().Get("w")
}

// clientIP extracts the caller address from proxy headers first (X-Forwarded-For
// is trusted here because tracking pixels are public by design).
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		first := strings.TrimSpace(strings.Split(fwd, ",")[0])
		if first != "" {
			return first
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) enqueueTrackEvent(r *http.Request, campaignID, contactID, workspaceID, eventType, url string) {
	if campaignID == "" || contactID == "" {
		return
	}
	if workspaceID == "" && s.db != nil {
		ws := ""
		if c, err := s.db.GetCampaignByID(r.Context(), campaignID); err == nil {
			ws = c.WorkspaceID
		}
		workspaceID = ws
	}

	dev := analytics.DetectDevice(r.UserAgent())
	countryCode := strings.TrimSpace(r.Header.Get("CF-IPCountry"))

	_ = s.queue.EnqueueRecordEvent(r.Context(), queueRecordEventPayload{
		WorkspaceID: workspaceID,
		CampaignID:  campaignID,
		ContactID:   contactID,
		Type:        eventType,
		URL:         url,
		Device:      dev.Name,
		Platform:    dev.Platform,
		Country:     analytics.CountryName(countryCode),
		CountryCode: countryCode,
		UserAgent:   r.UserAgent(),
		IP:          clientIP(r),
	})
}

func (s *Server) handleTrackOpen(w http.ResponseWriter, r *http.Request) {
	campaignID, contactID, workspaceID := trackParams(r)
	s.enqueueTrackEvent(r, campaignID, contactID, workspaceID, "opened", "")
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(transparentPixel)
}

func (s *Server) handleTrackClick(w http.ResponseWriter, r *http.Request) {
	campaignID, contactID, workspaceID := trackParams(r)
	target := r.URL.Query().Get("u")
	if target == "" {
		http.NotFound(w, r)
		return
	}
	decoded, err := url.QueryUnescape(target)
	if err != nil {
		decoded = target
	}
	s.enqueueTrackEvent(r, campaignID, contactID, workspaceID, "clicked", decoded)
	http.Redirect(w, r, decoded, http.StatusFound)
}

func (s *Server) handleTrackUnsubscribe(w http.ResponseWriter, r *http.Request) {
	campaignID, contactID, workspaceID := trackParams(r)
	s.enqueueTrackEvent(r, campaignID, contactID, workspaceID, "unsubscribed", "")
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte("<!doctype html><html><body><h2>You've been unsubscribed.</h2><p>You won't receive further emails from this sender.</p></body></html>"))
}
