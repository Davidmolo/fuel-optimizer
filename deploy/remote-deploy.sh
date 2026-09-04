#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "==> Deploying Fuel Optimizer from $APP_DIR"

if [[ ! -f backend/.env.prod ]]; then
  echo "Missing backend/.env.prod on the server. Copy backend/.env.example and fill production values." >&2
  exit 1
fi

if [[ ! -f frontend/.env.prod ]]; then
  echo "Missing frontend/.env.prod on the server. Copy frontend/.env.prod.example and fill production values." >&2
  exit 1
fi

echo "==> Building backend"
cd "$APP_DIR/backend"
npm ci
npm run build

echo "==> Building frontend"
cd "$APP_DIR/frontend"
npm ci
npm run build

echo "==> Reloading PM2"
cd "$APP_DIR"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

if sudo -n true 2>/dev/null; then
  echo "==> Refreshing nginx site fueloptimiser.azfsllc.com"
  sudo cp "$APP_DIR/deploy/nginx-fueloptimiser.conf" /etc/nginx/sites-available/fueloptimiser
  sudo ln -sf /etc/nginx/sites-available/fueloptimiser /etc/nginx/sites-enabled/fueloptimiser
  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "Skipping nginx refresh (passwordless sudo not available). Run deploy/first-setup.sh once if the site is not wired yet."
fi

wait_http() {
  local url="$1"
  local name="$2"
  local attempts="${3:-45}"
  local i=1

  while (( i <= attempts )); do
    if curl -fsS --max-time 5 "$url" >/tmp/fuel-health.out; then
      echo "$name is up"
      cat /tmp/fuel-health.out
      echo
      return 0
    fi
    echo "Waiting for $name ($i/$attempts)..."
    sleep 2
    i=$((i + 1))
  done

  echo "$name did not become ready at $url" >&2
  echo "==> PM2 status" >&2
  pm2 list >&2 || true
  echo "==> API logs" >&2
  pm2 logs fuel-optimizer-api --lines 80 --nostream >&2 || true
  echo "==> Worker logs" >&2
  pm2 logs fuel-optimizer-worker --lines 40 --nostream >&2 || true
  echo "==> Web logs" >&2
  pm2 logs fuel-optimizer-web --lines 40 --nostream >&2 || true
  return 1
}

echo "==> Health checks"
wait_http "http://127.0.0.1:5000/api/v1/health" "API" 45
wait_http "http://127.0.0.1:3020/" "frontend" 20

echo "==> Deploy complete"
pm2 list
