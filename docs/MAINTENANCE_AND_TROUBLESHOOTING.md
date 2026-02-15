# Kenya Farms AI - Maintenance & Troubleshooting Guide

**Version 2.0.0**

---

## 1. Health Checks

### Quick Health Check

```bash
curl https://your-api.onrender.com/api/admin/health
```

**Expected response:**
```json
{
  "status": "ok",
  "db": "connected"
}
```

If `db` is `"disconnected"`, use **Force Reconnect DB** from the Maintenance page.

### Detailed System Health

```bash
curl -H "Authorization: Bearer <admin-token>" \
  https://your-api.onrender.com/api/admin/system/health-details
```

Returns CPU, RAM, disk usage, and service status.

---

## 2. Common Issues & Fixes

### Database Disconnected

**Symptoms:** 503 errors, "DB disconnected", health check shows `"db":"disconnected"`.

**Causes:**
- Idle timeout (e.g. Render free tier)
- Migration ran and connection pool stale
- Network/SSL issues

**Fix:**
1. **Maintenance page** → **Force Reconnect DB**
2. Or call: `POST /api/admin/settings/reconnect-db` (admin token required)
3. If on Render, ensure Internal Database URL and SSL are configured (see `INSTALLATION_AND_INFRASTRUCTURE.md`).

---

### Migrations Failed / DB Disconnected After Migration

**Symptoms:** "Run migrations failed", DB shows disconnected after running migrations.

**Fix:**
1. Run **Force Reconnect DB** from Maintenance page.
2. Re-run migrations if needed.
3. Ensure migration 006 has run (creates `system_config` and seeds defaults).

---

### "No endpoint config. Run migration 006 to seed defaults."

**Symptoms:** Settings page shows no ports/endpoints.

**Fix:**
1. Run **Run Full Database Migrations** from Maintenance page.
2. Or use **Seed default ports & endpoints** on Ports/Endpoints tabs.
3. Or call: `POST /api/admin/settings/seed-config`.

---

### Farmer Registration "Request failed. Please try again"

**Symptoms:** Request Farmer Access fails with generic error.

**Checks:**
1. Auth-service is running and up to date (rebuild with `--no-cache` if needed).
2. `/api/auth/request-access` is not rate-limited (5 req/min).
3. Database is connected.
4. Check auth-service logs for validation or DB errors.

---

### Admin App Not Connecting on Render (Works on Localhost)

**Symptoms:** Admin app works locally but fails on Render.

**Checks:**
1. Use **Internal Database URL** for Render PostgreSQL (same region).
2. SSL: `sslmode=require` and `ssl: { rejectUnauthorized: false }` in all `db.js` files.
3. CORS: API Gateway must allow your Render frontend URL.
4. Environment variables: `API_URL` in frontend must point to your Render API URL.

---

### Docker Service Won't Start / Outdated Image

**Symptoms:** Service returns 404 or old behavior.

**Fix:**
1. **Maintenance page** → **Rebuild & Restart Service** → select service → Rebuild.
2. Or manually:
   ```bash
   docker compose build --no-cache <service-name>
   docker compose up -d <service-name>
   ```

---

### Ports / Endpoints Not Saving

**Symptoms:** Settings changes don't persist.

**Checks:**
1. Migration 006 has created `system_config` table.
2. Seed config if table is empty: **Seed default ports & endpoints**.
3. Check admin-service logs for DB errors.

---

## 3. Logs & Debugging

### View Logs

- **Maintenance page** → **System Logs** tab.
- Or: `GET /api/admin/settings/logs` (admin token).

### Service Logs (Docker)

```bash
docker compose logs -f api-gateway
docker compose logs -f auth-service
docker compose logs -f admin-service
docker compose logs -f farmer-service
docker compose logs -f system-service
```

### Database Logs (Render)

- Render Dashboard → Database → Logs.

---

## 4. Maintenance Tasks

### Regular Tasks

| Task | Frequency | How |
|------|-----------|-----|
| Backup DB | Daily/Weekly | Render auto-backups; export for manual backup |
| Check health | Daily | `GET /api/admin/health` |
| Review logs | Weekly | Maintenance page or `GET /api/admin/settings/logs` |
| Update dependencies | Monthly | `npm update` in each service |

### Run Migrations

1. **Maintenance page** → **Run Full Database Migrations**.
2. Or: `POST /api/admin/settings/run-migrations`.
3. After migrations, run **Force Reconnect DB** if DB shows disconnected.

### Check Migration Status

- **Maintenance page** → **Check Migration Status**.
- Or: `GET /api/admin/settings/migration-status`.

---

## 5. Restart & Rebuild

### Restart All Services

- **Maintenance page** → **Restart System**.
- Or: `docker compose restart` (local).

### Rebuild Single Service

- **Maintenance page** → **Rebuild & Restart Service** → select service.
- Ensures latest code and `--no-cache` build.

---

## 6. Security

- Rotate JWT secret periodically.
- Use strong passwords for DB and admin.
- Restrict CORS in production.
- Keep SSL enabled for Render DB.

---

## 7. Support

For persistent issues:
1. Capture health response, migration status, and recent logs.
2. Check `docs/INSTALLATION_AND_INFRASTRUCTURE.md` for env and SSL setup.
3. Review `docs/DEVELOPER_MANUAL.md` for local debugging.
