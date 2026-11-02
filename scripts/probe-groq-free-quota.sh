#!/usr/bin/env bash
# Owner-operated account check; never log API keys or user data.
# Makes exactly ONE intentionally authorized, minimal real model request.
set -euo pipefail
if [[ "${WATT_GROQ_FREE_CONFIRMED:-}" != "true" || "${WATT_FREE_ONLY:-}" != "true" ]]; then
  echo "STOP: Confirm this Groq organization is genuinely free, with no paid overages, before probing." >&2
  exit 3
fi
if [[ -z "${GROQ_API_KEY:-}" ]]; then
  echo "STOP: GROQ_API_KEY is not configured in this authenticated shell (never paste it in chat)." >&2
  exit 3
fi
if ! command -v curl >/dev/null 2>&1; then
  echo "STOP: curl is required." >&2
  exit 3
fi
headfile="$(mktemp)"; bodyfile="$(mktemp)"
trap 'rm -f "$headfile" "$bodyfile"' EXIT
chmod 600 "$headfile" "$bodyfile"
echo "One Groq free-account model request will be made. No private room contents are sent."
payload='{"model":"openai/gpt-oss-20b","stream":false,"reasoning_effort":"low","include_reasoning":false,"max_completion_tokens":24,"messages":[{"role":"user","content":"Reply with OK."}]}'
status="$(curl --silent --show-error --connect-timeout 8 --max-time 30 \
  --dump-header "$headfile" --output "$bodyfile" --write-out '%{http_code}' \
  --request POST --url 'https://api.groq.com/openai/v1/chat/completions' \
  --header "Authorization: Bearer ${GROQ_API_KEY}" \
  --header 'Content-Type: application/json' --data-binary "$payload")"
printf 'Provider HTTP status: %s\n' "$status"
grep -iE '^x-ratelimit-(limit|remaining|reset)-(requests|tokens):' "$headfile" | tr -d '\r' || true
if [[ "$status" != "200" ]]; then
  echo "Quota NOT verified. Do not assume capacity, change plans or enable WATT AI." >&2
  exit 4
fi
echo "Provider allowed one request. Recheck the organization Limits page for tokens/day and paid-plan status."
