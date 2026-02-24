#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/telegram.env"

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
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "Aviso: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID no configurados; no se enviará a Telegram."
    return 0
  fi

  local text
  text=$'Nuevo enlace HTTPS de QRScanner ✅\n\n'"$url"$'\n\nServidor local: http://localhost:5173'

  curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${text}" >/tmp/qrscanner-telegram.log || true
}

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    kill "$DEV_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

npm run dev:phone >/tmp/qrscanner-dev.log 2>&1 &
DEV_PID=$!

# Espera corta para que levante el servidor local.
sleep 2

echo "Servidor local: http://localhost:5173"
echo "Abriendo túnel HTTPS..."
echo ""

cloudflared tunnel --url http://127.0.0.1:5173 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [[ "${SENT_LINK:-0}" != "1" ]] && [[ "$line" =~ https://[a-zA-Z0-9.-]+\.trycloudflare\.com ]]; then
    TUNNEL_URL="${BASH_REMATCH[0]}"
    SENT_LINK=1
    echo "Enlace HTTPS detectado: $TUNNEL_URL"
    send_telegram "$TUNNEL_URL"
  fi
done
