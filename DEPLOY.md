# Deploy to livehospital.org

Node.js + MySQL app. Express serves the website and API on one port (5006); Nginx handles HTTPS and proxies to Node.

## Requirements

- VPS (Ubuntu 22.04 recommended) — Hostinger, DigitalOcean, AWS Lightsail, etc.
- Domain **livehospital.org** DNS pointing to server IP
- Node.js 18+, MySQL 8+, Nginx, PM2

---

## Step 1: DNS Setup

At your domain registrar, add these records:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP *(or CNAME www → livehospital.org)* |
| A | panel | YOUR_SERVER_IP |

Wait 5–30 minutes for DNS to propagate.

**Email forwarding:** Set `support@livehospital.org` → your Gmail at the registrar. See `deploy/EMAIL_SETUP.md`.

---

## Step 2: Server Setup (Ubuntu)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx mysql-server git curl

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm install -g pm2
```

---

## Step 3: MySQL Database

```bash
sudo mysql
```

```sql
CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'livehospital_user'@'localhost' IDENTIFIED BY 'YOUR_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON hospital_db.* TO 'livehospital_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import schema:

```bash
mysql -u livehospital_user -p hospital_db < /var/www/livehospital.org/server/database.sql
cd /var/www/livehospital.org/server
node setup-security.js
```

---

## Step 4: Upload Project

**Option A — Git**

```bash
sudo mkdir -p /var/www/livehospital.org
sudo chown -R $USER:$USER /var/www/livehospital.org
cd /var/www/livehospital.org
git clone YOUR_REPO_URL .
cd server && npm install --production
```

**Option B — ZIP upload**

Upload the `hospital-doctor-availability` folder to `/var/www/livehospital.org` via SFTP (FileZilla / WinSCP), then:

```bash
cd /var/www/livehospital.org/server
npm install --production
```

---

## Step 5: Production Environment

```bash
cp /var/www/livehospital.org/server/.env.production.example /var/www/livehospital.org/server/.env
nano /var/www/livehospital.org/server/.env
```

Set real values:

```
NODE_ENV=production
PORT=5006
DB_HOST=localhost
DB_USER=livehospital_user
DB_PASSWORD=YOUR_STRONG_DB_PASSWORD
DB_NAME=hospital_db
JWT_SECRET=generate-a-long-random-string-here
JWT_EXPIRES_IN=7d
PUBLIC_BASE_URL=https://livehospital.org
ADMIN_PANEL_BASE_URL=https://panel.livehospital.org
```

Generate JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Step 6: Start with PM2

```bash
cd /var/www/livehospital.org
pm2 start deploy/ecosystem.config.js --env production
pm2 save
pm2 startup
```

Check:

```bash
pm2 status
curl http://127.0.0.1:5006/api
```

---

## Step 7: Nginx + SSL

```bash
sudo cp /var/www/livehospital.org/deploy/nginx-livehospital.conf /etc/nginx/sites-available/livehospital.org
sudo ln -sf /etc/nginx/sites-available/livehospital.org /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d livehospital.org -d www.livehospital.org -d panel.livehospital.org
```

---

## Step 8: Verify

- https://livehospital.org — public website (no admin links)
- https://panel.livehospital.org/admin.html — super admin
- https://panel.livehospital.org/hospital-admin.html — hospital admins (multiple)
- https://panel.livehospital.org/blood-admin.html — blood admins (multiple)
- https://livehospital.org/api/hospitals — public API

**Admin login (Super Admin)**

- URL: https://panel.livehospital.org/admin.html
- Email: `sharma.sachinctr@gmail.com`
- Password: `comingsoon@123`

**Share with new admins:** give only their panel URL + credentials (not livehospital.org/admin).

---

## Useful Commands

```bash
pm2 logs livehospital          # View logs
pm2 restart livehospital       # Restart after code update
pm2 stop livehospital          # Stop app

# MySQL backup
mysqldump -u livehospital_user -p hospital_db > backup.sql
```

---

## After Code Updates

```bash
cd /var/www/livehospital.org
git pull   # or re-upload files
cd server && npm install --production
pm2 restart livehospital
```

---

## Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Do **not** expose port 5006 publicly — only Nginx (80/443) should be open.
