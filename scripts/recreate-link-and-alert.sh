#!/usr/bin/env bash
set -euo pipefail

recreate_link_and_alert() {
  echo "Deteniendo procesos previos de Vite/Cloudflare Tunnel..."
  pkill -f "vite --host 0.0.0.0 --port 5173" >/dev/null 2>&1 || true
  pkill -f "cloudflared tunnel --url http://127.0.0.1:5173" >/dev/null 2>&1 || true

  echo "Iniciando nuevo túnel HTTPS y notificación por Telegram..."
  exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-https-tunnel.sh"
}

recreate_link_and_alert "$@"
