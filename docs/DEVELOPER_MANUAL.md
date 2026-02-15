# Kenya Farms AI - Developer Manual

**Version 2.0.0**

---

## 1. Overview

Kenya Farms AI is a modular IoT and AI platform for Kenyan farmers. The system comprises:

- **7 Microservices** (Node.js/Express)
- **3 Frontends** (React)
- **3 Databases** (PostgreSQL, MongoDB, Redis)

---

## 2. Development Environment Setup

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime |
| npm | 9+ | Package manager |
| Docker | 20+ | Local databases (optional) |
| Git | 2.x | Version control |

### Clone & Install

```bash
git clone https://github.com/hellacardmcc-arch/kenya-farms-ai.git
cd kenya-farms-ai
npm run install:all
```

### Environment Variables

Create `.env` in project root (optional for local dev):

```env
POSTGRES_PASSWORD=kfiot_secret
JWT_SECRET=your-secret-change-in-production
```

---

## 3. Project Structure

```
kenya-farms-ai/
├── services/                 # Backend microservices
│   ├── api-gateway/         # Port 5001 - Entry point, routing
│   ├── auth-service/        # Port 5002 - JWT, users
│   ├── farmer-service/      # Port 4002 - Farms, crops
│   ├── device-service/      # Port 4003 - IoT devices
│   ├── analytics-service/   # Port 4004 - Reports
│   ├── notification-service/# Port 4005 - Alerts
│   ├── admin-service/       # Port 4006 - Admin panel backend
│   └── system-service/      # Port 4007 - System config, sensors/robots
├── frontend/
│   ├── farmer-app/          # Farmer dashboard (port 3000)
│   ├── admin-app/           # Admin panel (port 3000)
│   └── public-app/          # Public landing (port 4001)
├── databases/
│   └── postgres/
│       ├── init.sql         # Base schema
│       └── migrations/      # 001-007 migrations
├── deploy/                  # Deployment guides
└── docs/                    # Documentation
```

---

## 4. Running Locally

### Option A: Docker (Recommended)

```bash
docker-compose up -d postgres
# Wait for postgres healthy, then:
npm run dev:gateway
npm run dev:auth
npm run dev:farmer
npm run dev:admin
npm run dev:system
# In separate terminals:
npm run dev:farmer-app
npm run dev:admin-app
```

### Option B: All Services

```bash
docker-compose up -d
npm run dev:services    # All 7 microservices
npm run dev:farmer-app  # Terminal 2
npm run dev:admin-app   # Terminal 3
```

### Option C: Minimal (PostgreSQL + Core)

```bash
docker-compose up -d postgres
npm run dev:gateway
npm run dev:auth
npm run dev:farmer
npm run dev:admin
npm run dev:system
npm run dev:farmer-app
```

---

## 5. Database Migrations

Run migrations before first use:

```bash
# Via Docker
docker run --rm -v "${PWD}/databases/postgres:/migrations" postgres:15-alpine \
  psql "postgresql://kfiot:kfiot_secret@host.docker.internal:5432/kenya_farm_iot?sslmode=disable" \
  -f /migrations/init.sql

# Then migrations 001-007
for f in databases/postgres/migrations/*.sql; do
  docker run --rm -v "${PWD}/databases/postgres:/migrations" postgres:15-alpine \
    psql "postgresql://kfiot:kfiot_secret@host.docker.internal:5432/kenya_farm_iot?sslmode=disable" \
    -f /migrations/migrations/$(basename $f)
done
```

Or use Admin App → Settings → Maintenance → **Run Full Database Migrations**.

---

## 6. Coding Conventions

### Services (Node.js)

- **ES Modules** (`import`/`export`)
- **Express** for HTTP
- **pg** for PostgreSQL
- **bcryptjs** for passwords
- **jsonwebtoken** for JWT

### Frontend (React)

- **TypeScript** (admin-app, farmer-app)
- **React 18** with hooks
- **React Router** v6
- **Axios** for API calls

### API Design

- RESTful endpoints under `/api/<service>/*`
- JSON request/response
- JWT in `Authorization: Bearer <token>`
- Errors: `{ error: "message" }` with appropriate HTTP status

---

## 7. Adding a New Feature

1. **Backend**: Add route in relevant service (`services/<service>/index.js`)
2. **API Gateway**: Route is auto-proxied via `createProxyMiddleware`
3. **Frontend**: Add API function in `frontend/<app>/src/api/`
4. **UI**: Add component and wire to API

---

## 8. Testing

```bash
# Run tests (if configured)
npm test
```

---

## 9. Build for Production

```bash
# Frontends
cd frontend/farmer-app && npm run build
cd frontend/admin-app && npm run build

# Docker
docker-compose build
```

---

## 10. Useful Commands

| Command | Description |
|--------|-------------|
| `npm run dev:farmer-app` | Start farmer app |
| `npm run dev:admin-app` | Start admin app |
| `npm run dev:gateway` | Start API gateway |
| `npm run dev:auth` | Start auth service |
| `docker-compose up -d` | Start all services in Docker |
| `docker-compose down` | Stop all services |
