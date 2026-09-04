#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/fuel-optimizer}"
REPO_SSH="${REPO_SSH:-}"
BRANCH="${BRANCH:-main}"

echo "==> Fuel Optimizer first-time staging setup"
echo "    APP_DIR=$APP_DIR"

if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js and npm are required." >&2
  exit 1
fi

if ! command -v pm2 >/dev/null; then
  echo "pm2 is required (npm i -g pm2)." >&2
  exit 1
fi

if ! command -v nginx >/dev/null; then
  echo "nginx is required." >&2
  exit 1
fi

sudo mkdir -p "$APP_DIR"
sudo chown ubuntu:ubuntu "$APP_DIR"

if [[ ! -f "$APP_DIR/ecosystem.config.cjs" ]]; then
  if [[ -z "$REPO_SSH" ]]; then
    echo "No app files in $APP_DIR yet. Either set REPO_SSH=git@github.com:org/fuel-optimizer.git and re-run, or let GitHub Actions rsync the repo first." >&2
    exit 1
  fi
  echo "==> Cloning $REPO_SSH"
  git clone --branch "$BRANCH" "$REPO_SSH" "$APP_DIR"
else
  echo "==> App files already present at $APP_DIR"
fi

cd "$APP_DIR"

if [[ ! -f backend/.env.prod ]]; then
  cp backend/.env.example backend/.env.prod
  sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' backend/.env.prod
  sed -i 's/^PORT=.*/PORT=5000/' backend/.env.prod
  sed -i 's/^API_AUTH_REQUIRED=.*/API_AUTH_REQUIRED=true/' backend/.env.prod
  if grep -q '^RECOMMENDATION_DEMO_MODE=' backend/.env.prod; then
    sed -i 's/^RECOMMENDATION_DEMO_MODE=.*/RECOMMENDATION_DEMO_MODE=false/' backend/.env.prod
  else
    printf '\nRECOMMENDATION_DEMO_MODE=false\n' >> backend/.env.prod
  fi
  echo "Created backend/.env.prod from the example. Edit it with production secrets before deploying."
fi

if [[ ! -f frontend/.env.prod ]]; then
  cp frontend/.env.prod.example frontend/.env.prod
  echo "Created frontend/.env.prod from the example."
fi

chmod +x deploy/remote-deploy.sh deploy/first-setup.sh

echo "==> Installing nginx site (leaves fuel-staging and trailhead untouched)"
sudo cp deploy/nginx-fueloptimiser.conf /etc/nginx/sites-available/fueloptimiser
sudo ln -sf /etc/nginx/sites-available/fueloptimiser /etc/nginx/sites-enabled/fueloptimiser
sudo nginx -t
sudo systemctl reload nginx

echo
echo "Next:"
echo "  1. Edit $APP_DIR/backend/.env.prod (Mongo, API keys, SMTP, PORT=5000)."
echo "  2. Keep $APP_DIR/frontend/.env.prod NEXT_PUBLIC_API_BASE_URL=https://fueloptimiser.azfsllc.com"
echo "  3. Add the GitHub Actions SSH public key to ~/.ssh/authorized_keys."
echo "  4. Add GitHub secrets STAGING_HOST and STAGING_SSH_KEY."
echo "  5. Push to $BRANCH or run the Deploy staging workflow."
echo
echo "Optional first build now:"
echo "  bash $APP_DIR/deploy/remote-deploy.sh"
