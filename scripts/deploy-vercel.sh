#!/usr/bin/env bash
# Deploy Artifact Hub to Vercel from apps/web (monorepo root).
# Prereqs: npx vercel login, apps/web/.env.local with Supabase + API key vars.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
ENV_FILE="$WEB/.env.local"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-/tmp/npm-cache-vercel}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.example and fill in values."
  exit 1
fi

cd "$WEB"

if ! npx vercel@latest whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: npx vercel login"
  exit 1
fi

echo "Linking Vercel project (root: apps/web)..."
npx vercel@latest link --yes

add_env() {
  local key="$1"
  local value="$2"
  local target="$3"
  if npx vercel@latest env ls "$target" 2>/dev/null | grep -q "^[[:space:]]*${key}[[:space:]]"; then
    printf '%s' "$value" | npx vercel@latest env update "$key" "$target" --yes
  else
    printf '%s' "$value" | npx vercel@latest env add "$key" "$target" --yes
  fi
}

echo "Syncing production env vars from .env.local..."
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  [[ -z "$key" || -z "$value" ]] && continue
  # Ollama is local-only; skip for Vercel serverless.
  case "$key" in
    OLLAMA_BASE_URL|OLLAMA_MODEL|LLM_PROVIDER) continue ;;
  esac
  add_env "$key" "$value" production
done < "$ENV_FILE"

# Production needs a cloud LLM if metadata/search should work server-side.
if ! npx vercel@latest env ls production 2>/dev/null | grep -q GROQ_API_KEY; then
  echo "Tip: add GROQ_API_KEY in Vercel for LLM metadata in production (Ollama won't run on Vercel)."
fi

echo "Deploying to production..."
DEPLOY_URL="$(npx vercel@latest deploy --prod --yes 2>&1 | tee /dev/stderr | grep -Eo 'https://[a-zA-Z0-9.-]+\.vercel\.app' | tail -1)"

if [[ -n "${DEPLOY_URL:-}" ]]; then
  echo "Setting NEXT_PUBLIC_APP_URL=$DEPLOY_URL"
  add_env NEXT_PUBLIC_APP_URL "$DEPLOY_URL" production
  npx vercel@latest deploy --prod --yes
  echo "Live at: $DEPLOY_URL"
else
  echo "Deploy finished — check Vercel dashboard for the production URL."
fi
