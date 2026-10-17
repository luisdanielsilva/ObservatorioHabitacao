#!/usr/bin/env bash
# Deploys the current main branch (WBS 3.2.3): pull, install, migrate, build, restart.
# Run as deploy from /var/www/olhovivo. Needs a sudoers rule allowing
#   deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart observatorio-habitacao-web
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
npm ci
set -a; source /etc/observatorio-habitacao.env; set +a
npm run db:backup -w @observatorio-habitacao/db   # safety copy before migrating
npm run db:migrate
# Build with lower priority so the running site stays responsive on the small VPS.
nice -n 10 npm run build -w @observatorio-habitacao/web
sudo systemctl restart observatorio-habitacao-web
echo "Deployed $(git rev-parse --short HEAD)"
