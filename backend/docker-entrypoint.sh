#!/bin/sh
# Wait for the database, apply migrations, then serve the API.
set -eu
python -m app.core.wait_for_db
alembic upgrade head
exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port 8000 --no-server-header
