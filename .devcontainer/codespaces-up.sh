#!/usr/bin/env bash
# Prepare an untracked .env, then proxy the Compose app to ports Codespaces forwards.
# Does not print the database password and does not seed an administrator password.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="${1:-proxy}"

log() {
  printf '%s\n' "$*"
}

is_placeholder() {
  local value
  value=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  case "$value" in
    "" | change-me | changeme | change_me | password | postgres | openkita | secret) return 0 ;;
    *) return 1 ;;
  esac
}

# Compose treats an unquoted # as a comment and interpolates $. Single quotes are literal.
env_quote() {
  local value=$1
  if [[ "$value" =~ ^[A-Za-z0-9]+$ ]]; then
    printf '%s' "$value"
    return
  fi
  printf "'%s'" "$value"
}

random_password() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 24
    return
  fi
  od -An -tx1 -N 24 /dev/urandom | tr -d ' \n'
}

ensure_env() {
  local pw origin tmp quoted
  if [[ ! -f .env ]]; then
    pw="${POSTGRES_PASSWORD:-}"
    if is_placeholder "$pw" || [[ "$pw" == *$'\n'* || "$pw" == *"'"* ]]; then
      if [[ -n "${POSTGRES_PASSWORD:-}" ]]; then
        log "POSTGRES_PASSWORD from the environment is a placeholder or cannot be stored safely. Generated a new one."
      else
        log "POSTGRES_PASSWORD is not set. Generated one in the untracked .env."
      fi
      log "To choose it yourself, set a Codespaces secret named POSTGRES_PASSWORD and recreate the codespace."
      pw=$(random_password)
    else
      log "Using the POSTGRES_PASSWORD codespace secret. Stored only in the untracked .env."
    fi
    umask 077
    tmp=$(mktemp)
    quoted=$(env_quote "$pw")
    OPENKITA_DB_PASSWORD="$quoted" awk '
      BEGIN { pw = ENVIRON["OPENKITA_DB_PASSWORD"]; set = 0 }
      /^POSTGRES_PASSWORD=/ { print "POSTGRES_PASSWORD=" pw; set = 1; next }
      { print }
      END { if (!set) print "POSTGRES_PASSWORD=" pw }
    ' .env.example >"$tmp"
    {
      printf '%s\n' "SESSION_COOKIE_SECURE=true"
      if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
        origin="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
        printf '%s\n' "PUBLIC_ORIGIN=${origin}"
      fi
    } >>"$tmp"
    mv "$tmp" .env
    chmod 600 .env
  else
    pw=$(awk -F= '/^POSTGRES_PASSWORD=/{ print substr($0, index($0, "=") + 1); exit }' .env)
    pw=${pw#\'}
    pw=${pw%\'}
    if is_placeholder "$pw"; then
      log "The untracked .env has an empty or placeholder POSTGRES_PASSWORD. Refusing to start."
      exit 1
    fi
  fi

  if [[ -z "${CODESPACE_NAME:-}" ]]; then
    return
  fi
  if ! grep -q '^SESSION_COOKIE_SECURE=true$' .env; then
    grep -v '^SESSION_COOKIE_SECURE=' .env >.env.openkita-tmp
    printf '%s\n' "SESSION_COOKIE_SECURE=true" >>.env.openkita-tmp
    mv .env.openkita-tmp .env
    chmod 600 .env
  fi
  if [[ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
    origin="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    if ! grep -qxF "PUBLIC_ORIGIN=${origin}" .env; then
      grep -v '^PUBLIC_ORIGIN=' .env >.env.openkita-tmp
      printf '%s\n' "PUBLIC_ORIGIN=${origin}" >>.env.openkita-tmp
      mv .env.openkita-tmp .env
      chmod 600 .env
    fi
    # Frontend reads this file only, so the database password is not in its environment.
    printf '%s\n' "PUBLIC_ORIGIN=${origin}" >.devcontainer/.env.public
    chmod 600 .devcontainer/.env.public
  fi
}

ensure_packages() {
  if command -v socat >/dev/null 2>&1 && command -v curl >/dev/null 2>&1; then
    return
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    apt-get update
    apt-get install -y --no-install-recommends socat curl ca-certificates
  else
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends socat curl ca-certificates
  fi
}

start_proxy() {
  local port=$1 target=$2
  local pidfile="/tmp/openkita-proxy-${port}.pid"
  if [[ -f "$pidfile" ]]; then
    kill "$(cat "$pidfile")" >/dev/null 2>&1 || true
    rm -f "$pidfile"
    sleep 0.2
  fi
  socat "TCP-LISTEN:${port},bind=0.0.0.0,reuseaddr,fork" "TCP:${target}" &
  printf '%s\n' "$!" >"$pidfile"
}

wait_for_app() {
  local attempt
  for attempt in $(seq 1 60); do
    if curl -fsS -o /dev/null "http://backend:8000/health/live" && curl -fsS -o /dev/null "http://frontend:3000/"; then
      return
    fi
    sleep 5
  done
  log "Timed out waiting for the frontend and backend."
  exit 1
}

announce() {
  local attempt
  for attempt in $(seq 1 20); do
    if curl -fsS -o /dev/null "http://127.0.0.1:3000/"; then
      if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
        log "OpenKita is healthy: https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
      else
        log "OpenKita is healthy: http://localhost:3000"
      fi
      log "Open the forwarded port 3000 URL and complete first-run setup."
      log "Ollama is not part of this codespace. A parent letter reports that the local model is not reachable."
      return
    fi
    sleep 1
  done
  log "The app did not answer on port 3000."
  exit 1
}

case "$MODE" in
  env)
    ensure_env
    ;;
  proxy)
    ensure_packages
    wait_for_app
    start_proxy 3000 "frontend:3000"
    start_proxy 8000 "backend:8000"
    announce
    ;;
  *)
    log "Usage: codespaces-up.sh env|proxy"
    exit 1
    ;;
esac
