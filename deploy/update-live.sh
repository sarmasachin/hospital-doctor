#!/bin/bash
# LiveHospital — pull latest code and verify design deploy
# Run on VPS: bash /var/www/livehospital.org/deploy/update-live.sh

set -e
APP_ROOT="/var/www/livehospital.org"

cd "$APP_ROOT"

echo "=== Current commit ==="
git log -1 --oneline || true

echo "=== Fetching latest from GitHub ==="
git fetch origin main

echo "=== Updating files (reset to origin/main) ==="
git reset --hard origin/main

echo "=== New commit ==="
git log -1 --oneline

echo "=== Verify homepage design ==="
if grep -q 'class="top-header"' index.html && ! grep -q 'lh-site-header' index.html; then
    echo "OK: index.html has restored design (top-header)"
else
    echo "ERROR: index.html still has old design — check git remote"
    exit 1
fi

if [ -f site-chrome.css ]; then
    echo "WARN: site-chrome.css still exists (should be deleted)"
else
    echo "OK: site-chrome.css removed"
fi

echo "=== Restart PM2 ==="
pm2 restart livehospital || pm2 start deploy/ecosystem.config.js --env production
pm2 save

echo "=== Done ==="
echo "Check: https://livehospital.org/ (Ctrl+Shift+R hard refresh)"
