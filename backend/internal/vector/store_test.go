package vector

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func testPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("PG_TEST_DSN")
	if dsn == "" {
		t.Skip("PG_TEST_DSN not set; skipping live Postgres test")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestVectorCRUDAndSearch(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	s := New(pool)

	ws := uuid.NewString()
	a := uuid.NewString()
	b := uuid.NewString()
	c := uuid.NewString()

	if err := s.Upsert(ctx, ws, a, vecAt(0)); err != nil {
		t.Fatalf("upsert a: %v", err)
	}
	if err := s.Upsert(ctx, ws, b, vecAt(1)); err != nil {
		t.Fatalf("upsert b: %v", err)
	}
	if err := s.Upsert(ctx, ws, c, vecAt(2)); err != nil {
		t.Fatalf("upsert c: %v", err)
	}
	t.Cleanup(func() {
		for _, id := range []string{a, b, c} {
			_ = s.Delete(ctx, id)
		}
	})

	hits, err := s.SearchByVector(ctx, ws, vecAt(0), 3)
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(hits) != 3 || hits[0].ContactID != a {
		t.Fatalf("expected [a ...], got %+v", hits)
	}
	if hits[0].Score < hits[1].Score || hits[1].Score < hits[2].Score {
		t.Fatalf("scores should be descending: %+v", hits)
	}

	similar, err := s.SearchSimilar(ctx, ws, a, 3)
	if err != nil {
		t.Fatalf("similar: %v", err)
	}
	if len(similar) != 2 || similar[0].ContactID != b {
		t.Fatalf("expected [b ...], got %+v", similar)
	}

	// Workspace isolation.
	otherWS := uuid.NewString()
	hits, err = s.SearchByVector(ctx, otherWS, vecAt(0), 3)
	if err != nil {
		t.Fatalf("search other ws: %v", err)
	}
	if len(hits) != 0 {
		t.Fatalf("expected no hits in other workspace, got %d", len(hits))
	}

	if _, err := s.SearchSimilar(ctx, ws, uuid.NewString(), 3); err != ErrNoEmbedding {
		t.Fatalf("expected ErrNoEmbedding, got %v", err)
	}
}

func vecAt(pos int) []float32 {
	v := make([]float32, 1536)
	v[pos] = 1
	return v
}
