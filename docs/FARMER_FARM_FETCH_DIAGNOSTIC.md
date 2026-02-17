# Farmer Login → Farm Fetch Diagnostic

## Test Results Summary

### What Works
- **Login** – Farmer login via `/api/auth/login` succeeds and returns a valid JWT token.
- **Database** – Farmers and farms exist in the database; test farmer with farm "Test Farm A" was created successfully.
- **Frontend flow** – Login component calls `refreshFarms(token)` after successful login to load farms.

### What Was Blocking Farm Fetch

**Root cause: API Gateway → Farmer Service connection refused (ECONNREFUSED)**

- The API Gateway proxies `/api/farmers/me` to `http://farmer-service:4002`
- The farmer-service container was not accepting connections on port 4002
- Possible causes:
  1. Farmer-service listening on the wrong port (e.g. 3002 instead of 4002)
  2. Stale or misconfigured Docker image
  3. Container not fully started or crashed

### Fixes Applied

1. **docker-compose.yml** – Added explicit `PORT: 4002` for farmer-service so it always listens on 4002.
2. **Test script** – `services/auth-service/scripts/test-farmer-farm-fetch.js` creates a test farmer and runs the full flow.

## How to Test

### Option 1: Run the diagnostic script (creates test farmer)

```bash
cd services/auth-service
node scripts/test-farmer-farm-fetch.js
```

With existing credentials:

```bash
node scripts/test-farmer-farm-fetch.js your@email.com yourpassword
```

### Option 2: Rebuild and restart farmer-service

If farmer-service is not responding:

```bash
docker compose build farmer-service --no-cache
docker compose up -d farmer-service
```

### Option 3: Test from farmer app frontend

1. Start services: `docker compose up -d` or `npm run dev:services`
2. Start farmer app: `npm run dev:farmer-app` (port 7000)
3. Log in with a farmer account that has farms
4. After login, the FarmSelectorBar should show the registered farm name(s)

## API Flow

1. **Login** – `POST /api/auth/login` → Auth service → returns `{ token, user }`
2. **Fetch farms** – `GET /api/farmers/me` with `Authorization: Bearer <token>` → Farmer service → returns `{ farmer, farms, crops, tasks, alerts }`
3. **Display** – FarmContext stores `farms`; FarmSelectorBar and ManageFarmsSection render farm names

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 504 on /api/farmers/me | Farmer-service not reachable. Run `docker logs kenya-farm-iot-farmer-service-1` |
| ECONNREFUSED | Farmer-service not listening on 4002. Rebuild with `PORT: 4002` |
| 401 Unauthorized | JWT_SECRET mismatch between auth-service and farmer-service |
| 404 Farmer not found | User has no row in `farmers` table (ensureFarmer creates one for role=farmer) |
| Empty farms array | Farmer has no farms in `farms` table; add via admin or farmer app |
