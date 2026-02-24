#!/usr/bin/env bash
set -euo pipefail

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared no está instalado. Instálalo con: brew install cloudflared"
  exit 1
fi

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
cloudflared tunnel --url http://127.0.0.1:5173
