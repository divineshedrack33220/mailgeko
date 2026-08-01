-- Mailgeko Phase 2 pgvector search (Postgres)

-- Resize embeddings to OpenAI text-embedding-3-small (1536 dims) and index.
ALTER TABLE contact_embeddings ALTER COLUMN embedding TYPE vector(1536);

CREATE INDEX IF NOT EXISTS idx_embeddings_workspace ON contact_embeddings (workspace_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw ON contact_embeddings
    USING hnsw (embedding vector_cosine_ops);
