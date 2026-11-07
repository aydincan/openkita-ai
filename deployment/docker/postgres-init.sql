-- Runs once on first start of the database container (empty data directory).
-- Alembic migration 0001 does the same idempotently for existing databases.
CREATE EXTENSION IF NOT EXISTS vector;
