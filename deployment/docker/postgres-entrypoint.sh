#!/bin/sh
# Refuse placeholder database passwords before PostgreSQL initialises a data directory.
# Keep the list in sync with app.core.config._PLACEHOLDER_PASSWORDS.
set -eu

# Placeholder check only: lowercased, with surrounding whitespace removed.
# POSTGRES_PASSWORD itself is left unchanged for the official entrypoint.
password=$(printf '%s' "${POSTGRES_PASSWORD:-}" | tr '[:upper:]' '[:lower:]')
password=${password#"${password%%[![:space:]]*}"}
password=${password%"${password##*[![:space:]]}"}
case "$password" in
  ""|change-me|changeme|change_me|password|postgres|openkita|secret)
    echo "POSTGRES_PASSWORD is missing or a placeholder (such as 'change-me'). Set a strong, unique password in .env." >&2
    exit 1
    ;;
esac

exec docker-entrypoint.sh "$@"
