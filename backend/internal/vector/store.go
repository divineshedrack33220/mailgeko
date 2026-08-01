package vector

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNoEmbedding = errors.New("contact has no embedding")

type Hit struct {
	ContactID string
	Score     float64
}

type Store struct {
	pool *pgxpool.Pool
}

func New(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) Upsert(ctx context.Context, workspaceID, contactID string, vec []float32) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO contact_embeddings (contact_id, workspace_id, embedding, updated_at)
		VALUES ($1, $2, $3::vector, now())
		ON CONFLICT (contact_id) DO UPDATE
			SET workspace_id = EXCLUDED.workspace_id, embedding = EXCLUDED.embedding,
			    updated_at = now()`,
		contactID, workspaceID, encodeVector(vec))
	return err
}

func (s *Store) Delete(ctx context.Context, contactID string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM contact_embeddings WHERE contact_id = $1`, contactID)
	return err
}

func (s *Store) SearchByVector(ctx context.Context, workspaceID string, vec []float32, limit int) ([]Hit, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT contact_id, 1 - (embedding <=> $2::vector) AS score
		FROM contact_embeddings
		WHERE workspace_id = $1 AND embedding IS NOT NULL
		ORDER BY embedding <=> $2::vector
		LIMIT $3`, workspaceID, encodeVector(vec), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Hit
	for rows.Next() {
		var h Hit
		if err := rows.Scan(&h.ContactID, &h.Score); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func (s *Store) SearchSimilar(ctx context.Context, workspaceID, contactID string, limit int) ([]Hit, error) {
	var one int
	err := s.pool.QueryRow(ctx,
		`SELECT 1 FROM contact_embeddings WHERE contact_id = $1 AND embedding IS NOT NULL`,
		contactID).Scan(&one)
	if err == pgx.ErrNoRows {
		return nil, ErrNoEmbedding
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT ce.contact_id, 1 - (ce.embedding <=> q.embedding) AS score
		FROM contact_embeddings ce
		JOIN (SELECT embedding FROM contact_embeddings WHERE contact_id = $2) q ON true
		WHERE ce.workspace_id = $1 AND ce.contact_id <> $2 AND ce.embedding IS NOT NULL
		ORDER BY ce.embedding <=> q.embedding
		LIMIT $3`, workspaceID, contactID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Hit
	for rows.Next() {
		var h Hit
		if err := rows.Scan(&h.ContactID, &h.Score); err != nil {
			return nil, err
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

func encodeVector(v []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, x := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(x), 'f', 8, 32))
	}
	b.WriteByte(']')
	return b.String()
}
