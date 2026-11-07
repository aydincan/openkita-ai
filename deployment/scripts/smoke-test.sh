#!/usr/bin/env bash
# Verifies a running stack. Usage: deployment/scripts/smoke-test.sh [backend_url] [frontend_url]
set -euo pipefail
BACKEND="${1:-http://localhost:8000}"
FRONTEND="${2:-http://localhost:3000}"

echo "Backend  /health:"
curl -fsS "$BACKEND/health"; echo
echo "Frontend /api/health (proxy):"
curl -fsS "$FRONTEND/api/health"; echo
echo "Frontend / :"
curl -fsS -o /dev/null -w "HTTP %{http_code}\n" "$FRONTEND/"
