package embed

import (
	"context"
	"hash/fnv"
	"math"
)

// Static is a deterministic fake embedder for tests and local development.
// It produces unit-norm vectors derived from a text hash, so similar texts
// land close together in cosine space.
type Static struct {
	dims int
}

func NewStatic(dims int) *Static {
	if dims <= 0 {
		dims = 8
	}
	return &Static{dims: dims}
}

func (s *Static) Dimensions() int { return s.dims }

func (s *Static) Embed(_ context.Context, texts []string) ([][]float32, error) {
	out := make([][]float32, len(texts))
	for i, text := range texts {
		out[i] = s.vector(text)
	}
	return out, nil
}

func (s *Static) vector(text string) []float32 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(text))
	seed := h.Sum64()

	vec := make([]float32, s.dims)
	for i := range vec {
		// xorshift64star PRNG seeded from the text hash.
		seed ^= seed >> 12
		seed ^= seed << 25
		seed ^= seed >> 27
		vec[i] = float32(seed>>32)/math.MaxUint32*2 - 1
	}

	norm := float32(0)
	for _, v := range vec {
		norm += v * v
	}
	norm = float32(math.Sqrt(float64(norm)))
	if norm > 0 {
		for i := range vec {
			vec[i] /= norm
		}
	}
	return vec
}
