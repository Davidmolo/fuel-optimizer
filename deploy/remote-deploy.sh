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

echo "==> Health checks"
curl -fsS "http://127.0.0.1:5000/api/v1/health"
echo
curl -fsS -o /dev/null -w "frontend %{http_code}\n" "http://127.0.0.1:3020/"

echo "==> Deploy complete"
pm2 list
