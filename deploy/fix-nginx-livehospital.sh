#!/bin/bash
# Install LiveHospital nginx (public + panel). Does NOT remove govmocktest nginx.
set -e

if [ ! -f /var/www/livehospital.org/deploy/nginx-livehospital.conf ]; then
  echo "Missing /var/www/livehospital.org — git clone first."
  exit 1
fi

cp /var/www/livehospital.org/deploy/nginx-livehospital.conf /etc/nginx/sites-available/livehospital.org
ln -sf /etc/nginx/sites-available/livehospital.org /etc/nginx/sites-enabled/

echo "=== Enabled nginx sites ==="
ls -la /etc/nginx/sites-enabled/

nginx -t
systemctl reload nginx

echo "=== Done ==="
echo "Public : https://livehospital.org"
echo "Admin  : https://panel.livehospital.org/admin.html"
echo "Run if needed: certbot --nginx -d livehospital.org -d www.livehospital.org -d panel.livehospital.org"
