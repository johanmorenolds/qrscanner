#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/telegram.env"
CF_LOG="/tmp/qrscanner-cloudflared.log"
MAX_TUNNEL_ATTEMPTS="${MAX_TUNNEL_ATTEMPTS:-5}"
VALIDATION_RETRIES="${VALIDATION_RETRIES:-8}"
VALIDATION_SLEEP_SECONDS="${VALIDATION_SLEEP_SECONDS:-2}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared no está instalado. Instálalo con: brew install cloudflared"
  exit 1
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

send_telegram() {
  local url="$1"
  local extra_info="$2"

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "Aviso: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados; no se enviará a Telegram."
    return 0
  fi

  local text
  text=$'Nuevo enlace HTTPS de QRScanner ✅\n\n'"$url"$'\n\nServidor local: http://localhost:5173\n'"$extra_info"

  curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" >/tmp/qrscanner-telegram.log || true
}

cleanup() {
  if [[ -n "${TAIL_PID:-}" ]]; then
    kill "$TAIL_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${CF_PID:-}" ]]; then
    kill "$CF_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

npm run dev:phone >/tmp/qrscanner-dev.log 2>&1 &
DEV_PID=$!

sleep 2

if ! curl -sS --max-time 5 http://127.0.0.1:5173 >/dev/null 2>&1; then
  echo "No se pudo levantar Vite en http://127.0.0.1:5173"
  exit 1
fi

echo "Servidor local: http://localhost:5173"
echo "Abriendo túnel HTTPS..."
echo ""

GIT_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')"
LOCAL_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 'n/a')"
STARTED_AT="$(date '+%Y-%m-%d %H:%M:%S %Z')"
EXTRA_INFO=$'Branch: '"$GIT_BRANCH"$'\nCommit: '"$GIT_REF"$'\nIP local: '"$LOCAL_IP"$'\nInicio: '"$STARTED_AT"

TUNNEL_URL=""

for attempt in $(seq 1 "$MAX_TUNNEL_ATTEMPTS"); do
  echo "Intento de túnel ${attempt}/${MAX_TUNNEL_ATTEMPTS}..."
  : >"$CF_LOG"

  cloudflared tunnel --url http://127.0.0.1:5173 >"$CF_LOG" 2>&1 &
  CF_PID=$!

  for _ in $(seq 1 25); do
    if ! kill -0 "$CF_PID" >/dev/null 2>&1; then
      break
    fi

    TUNNEL_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com' "$CF_LOG" | tail -n 1 || true)"
    if [[ -n "$TUNNEL_URL" ]]; then
      break
    fi

    sleep 1
  done

  if [[ -z "$TUNNEL_URL" ]]; then
    echo "No se detectó URL de túnel en este intento; regenerando..."
    kill "$CF_PID" >/dev/null 2>&1 || true
    wait "$CF_PID" 2>/dev/null || true
    unset CF_PID
    continue
  fi

  echo "Enlace HTTPS detectado: $TUNNEL_URL"

  VALIDATED=0
  for retry in $(seq 1 "$VALIDATION_RETRIES"); do
    HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 12 "$TUNNEL_URL" || true)"
    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" || "$HTTP_CODE" == "304" ]]; then
      VALIDATED=1
      break
    fi

    echo "Validación ${retry}/${VALIDATION_RETRIES} fallida (HTTP: ${HTTP_CODE:-n/a}). Reintentando..."
    sleep "$VALIDATION_SLEEP_SECONDS"
  done

  if [[ "$VALIDATED" == "1" ]]; then
    echo "Enlace validado correctamente: $TUNNEL_URL"
    send_telegram "$TUNNEL_URL" "$EXTRA_INFO"
    break
  fi

  echo "Subdominio no resolvió o no respondió correctamente. Regenerando túnel..."
  kill "$CF_PID" >/dev/null 2>&1 || true
  wait "$CF_PID" 2>/dev/null || true
  unset CF_PID
  TUNNEL_URL=""
done

if [[ -z "$TUNNEL_URL" ]]; then
  echo "No fue posible crear un enlace HTTPS válido tras ${MAX_TUNNEL_ATTEMPTS} intentos."
  exit 1
fi

echo ""
echo "Túnel activo y validado: $TUNNEL_URL"
echo "Manteniendo el proceso en ejecución..."

tail -n +1 -f "$CF_LOG" &
TAIL_PID=$!

wait "$CF_PID"
