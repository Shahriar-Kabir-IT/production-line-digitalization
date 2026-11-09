# Deploying Ananta MES

Two servers:
- **App server** `192.168.18.64` (user `app`) — Node API + nginx + static web.
- **DB server** `192.168.10.205` (user `db`) — PostgreSQL (shared; we add a dedicated `ananta_mes` DB).

Public URL: **http://mes.ananta.com.bd** (DNS → app server).

## 1. DB server — create a dedicated database + user (does not touch existing DBs)
```sql
CREATE USER mes_app WITH PASSWORD '<db-pass>';
CREATE DATABASE ananta_mes OWNER mes_app;
```
Ensure Postgres `listen_addresses` includes the app server and `pg_hba.conf` allows
`mes_app@ananta_mes` from `192.168.18.64/32` (md5/scram). Reload Postgres.

## 2. App server — one-time provisioning (as root/sudo)
- Node 20 LTS (official binary → /usr/local), nginx, redis-server.

## 3. Code
```bash
git clone https://github.com/Shahriar-Kabir-IT/production-line-digitalization.git /home/app/mes
cd /home/app/mes/server && npm ci && cp ../deploy/server.env.production .env   # edit DATABASE_URL + JWT_SECRET
npx prisma migrate deploy && npm run seed && npm run build
cd /home/app/mes/web && npm ci && npm run build        # outputs web/dist
```

## 4. Services
```bash
sudo cp deploy/mes-api.service /etc/systemd/system/ && sudo systemctl enable --now mes-api
sudo cp deploy/nginx-mes.conf /etc/nginx/sites-available/mes
sudo ln -s /etc/nginx/sites-available/mes /etc/nginx/sites-enabled/mes
sudo nginx -t && sudo systemctl reload nginx
```

## Notes
- The device-lock IP anchor reads `X-Real-IP` (set by nginx). Keep that header in the config.
- TLS: put a real certificate on nginx (internal CA or Let's Encrypt) and switch `listen 443 ssl`.
- Redis is installed and ready; the app runs single-instance and does not require it yet
  (add the Socket.IO Redis adapter if you scale to multiple API processes).
