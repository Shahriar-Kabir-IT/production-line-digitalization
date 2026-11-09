# Deploying Ananta MES

Two servers (different subnets, so inter-server traffic is routed by the MikroTik):
- **App server** `192.168.18.64` (user `app`) — Node API + nginx + static web.
- **DB server** `192.168.10.205` (user `db`) — PostgreSQL 18 (shared cluster; we add a dedicated `ananta_mes` DB, existing DBs untouched).

Public URL: **http://mes.ananta.com.bd** — point internal DNS at the app server `192.168.18.64`.

> NOTE: The two servers are on different VLANs (`192.168.18.x` vs `192.168.10.x`). The MikroTik
> masquerades inter-VLAN traffic to its WAN IP, so Postgres sees the app server's connections
> arriving from **202.4.116.106**, not from `192.168.18.64`. The `pg_hba.conf` rule must match
> that observed source IP (see §1). Check `/var/log/postgresql/postgresql-18-main.log` if auth fails.

## 1. DB server — dedicated database + user (does NOT touch existing DBs)
Run as the `postgres` superuser (`sudo -u postgres psql`). Use a SQL file, not a heredoc, so a
piped `sudo -S` password doesn't get consumed as stdin:
```sql
CREATE ROLE mes_app LOGIN PASSWORD '<db-pass>';
CREATE DATABASE ananta_mes OWNER mes_app;
\c ananta_mes
ALTER SCHEMA public OWNER TO mes_app;          -- PG15+: owner needed or Prisma hits P1010
GRANT ALL ON SCHEMA public TO mes_app;
GRANT ALL PRIVILEGES ON DATABASE ananta_mes TO mes_app;
```
`listen_addresses` is already `*`. Append to `pg_hba.conf` the source IP Postgres actually sees
(the MikroTik WAN IP, plus the LAN IP as a fallback), then `SELECT pg_reload_conf();`:
```
host    ananta_mes    mes_app    202.4.116.106/32    scram-sha-256
host    ananta_mes    mes_app    192.168.18.64/32    scram-sha-256
```

## 2. App server — one-time provisioning (sudo)
- Node 20 LTS (official binary → /usr/local), nginx, redis-server, xz-utils.
- `chmod o+x /home/app` so nginx (`www-data`) can traverse into `web/dist` (home dirs are `750`).

## 3. Code + build
```bash
git clone https://github.com/Shahriar-Kabir-IT/production-line-digitalization.git /home/app/mes
cd /home/app/mes/server && npm ci && cp ../deploy/server.env.production .env   # edit DATABASE_URL + JWT_SECRET
npx prisma generate
npx prisma migrate deploy
set -a; . ./.env; set +a && npm run seed      # seed runs under ts-node, which does NOT auto-load .env
npm run build                                  # tsc emits to dist/ (entry: dist/src/index.js)
cd /home/app/mes/web && npm ci && npm run build   # outputs web/dist (empty VITE_API_URL = same-origin /api)
```

## 4. Services
```bash
sudo cp deploy/mes-api.service /etc/systemd/system/   # ExecStart = node dist/src/index.js
sudo systemctl daemon-reload && sudo systemctl enable --now mes-api
sudo cp deploy/nginx-mes.conf /etc/nginx/sites-available/mes
sudo ln -sf /etc/nginx/sites-available/mes /etc/nginx/sites-enabled/mes
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Verify
```bash
curl -s localhost:4000/api/health                                  # {"ok":true} style 200
curl -s -H 'Host: mes.ananta.com.bd' localhost/                    # 200, serves index.html
curl -s -H 'Host: mes.ananta.com.bd' localhost/api/health          # 200 via proxy
curl -s -H 'Host: mes.ananta.com.bd' -X POST localhost/api/auth/login \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"password"}'   # returns JWT
```
Seeded super admin: **admin / password**. System admin: **sysadmin / 1234**. Change these after first login.

## Notes
- The device-lock IP anchor reads `X-Real-IP` (set by nginx). Keep that header in the config.
- Redis is installed and enabled; the app runs single-instance and does not require it yet
  (add the Socket.IO Redis adapter only if you scale to multiple API processes).
- TLS: the MikroTik already forwards public 80/443 to a different app, so this MES is LAN-only for
  now. For external access, forward a spare public port to `192.168.18.64:80`, or add a real
  certificate on nginx (internal CA or Let's Encrypt) and switch `listen 443 ssl`.
