package embed

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Embedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
	Dimensions() int
}

// FromConfig builds an Embedder from app config. It returns nil when
// embedding is not configured (no provider enabled).
func FromConfig(provider, baseURL, apiKey, model string, dims int) Embedder {
	switch provider {
	case "static":
		return NewStatic(dims)
	default:
		if apiKey == "" {
			return nil
		}
		return NewOpenAI(baseURL, apiKey, model, dims)
	}
}

// OpenAI calls the OpenAI-compatible /embeddings endpoint (e.g. OpenAI,
// Azure, or any local model server exposing the same contract).
type OpenAI struct {
	baseURL    string
	apiKey     string
	model      string
	dims       int
	httpClient *http.Client
}

func NewOpenAI(baseURL, apiKey, model string, dims int) *OpenAI {
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	if model == "" {
		model = "text-embedding-3-small"
	}
	if dims <= 0 {
		dims = 1536
	}
	return &OpenAI{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		model:      model,
		dims:       dims,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

func (o *OpenAI) Dimensions() int { return o.dims }

type embedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type embedResponse struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
}

func (o *OpenAI) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, nil
	}
	body, err := json.Marshal(embedRequest{Model: o.model, Input: texts})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.baseURL+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := o.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("embedding API returned %d: %s", resp.StatusCode, truncate(raw, 300))
	}

	var parsed embedResponse
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, fmt.Errorf("embedding API response: %w", err)
	}
	out := make([][]float32, len(parsed.Data))
	for _, d := range parsed.Data {
		if d.Index >= 0 && d.Index < len(out) {
			out[d.Index] = d.Embedding
		}
	}
	for i := range out {
		if out[i] == nil {
			return nil, fmt.Errorf("embedding API missing result for input %d", i)
		}
	}
	return out, nil
}

func truncate(b []byte, n int) string {
	if len(b) > n {
		return string(b[:n])
	}
	return string(b)
}
