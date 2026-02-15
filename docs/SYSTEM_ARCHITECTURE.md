# Kenya Farms AI - System Architecture Manual

**Version 2.0.0**

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  Admin App (3000) │ Farmer App (3001) │ Public App (4001) │ Mobile/API       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (5001)                                   │
│  Routing │ Rate Limiting │ CORS │ Auth Middleware                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ Auth Service  │  │ Admin Service │  │ Farmer Service│  │ System Service│
│ (5002)        │  │ (5003)        │  │ (5004)        │  │ (5005)        │
└───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘
        │                    │                │                    │
        └────────────────────┴────────────────┴────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PostgreSQL (5432)                                          │
│  users │ access_requests │ farmers │ crops │ sensors │ robots │ system_config │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Responsibilities

| Service | Port | Responsibility |
|---------|------|----------------|
| **API Gateway** | 5001 | Single entry point, routing, rate limiting, CORS, JWT validation |
| **Auth Service** | 5002 | Login, register, request-access, profile, password |
| **Admin Service** | 5003 | Farmers, crops, access requests, sensors, robots, settings, migrations, maintenance |
| **Farmer Service** | 5004 | Farmer profiles, farms, crops, alerts |
| **System Service** | 5005 | System config, status, sensors/robots activation, irrigation, robot commands |

---

## 3. Data Flow

### Authentication Flow

```
Client → POST /api/auth/login → API Gateway → Auth Service
                                    → DB (users) → JWT issued → Client
```

### Admin Flow

```
Client (Bearer token) → API Gateway (validate JWT, check role=admin)
    → Admin Service → DB → Response
```

### Farmer Flow

```
Client (Bearer token) → API Gateway (validate JWT, check role=farmer)
    → Farmer/System Service → DB → Response
```

---

## 4. Database Schema (Summary)

| Table | Purpose |
|-------|---------|
| `users` | All users (admin, farmer) |
| `access_requests` | Pending farmer/admin signup requests |
| `farmers` | Farmer profiles, farms |
| `crops` | Crop definitions |
| `sensors` | Sensor registry |
| `robots` | Robot registry |
| `system_config` | Ports, endpoints, key-value config |
| `system_logs` | Maintenance logs |

Migrations: `001`–`007` in `databases/postgres/migrations/` and `services/admin-service/migrations/`.

---

## 5. Routing (API Gateway)

| Path Prefix | Proxied To |
|-------------|------------|
| `/api/auth` | Auth Service (5002) |
| `/api/admin` | Admin Service (5003) |
| `/api/farmers` | Farmer Service (5004) |
| `/api/system` | System Service (5005) |
| `/api/devices` | Devices Service (if present) |
| `/api/analytics` | Analytics Service (if present) |
| `/api/notifications` | Notifications Service (if present) |

---

## 6. Frontend Apps

| App | Port | Purpose |
|-----|------|---------|
| Admin App | 3000 | Admin dashboard, farmers, crops, sensors, robots, settings, maintenance |
| Farmer App | 3001 | Farmer dashboard, farms, crops, sensors, robots |
| Public App | 4001 | Public-facing info, landing |

---

## 7. Deployment (Render)

- **Web Service**: API Gateway + all backend services (monorepo).
- **PostgreSQL**: Render Internal Database.
- **Frontend**: Separate static site or Web Service.
- SSL required for DB; use Internal Database URL.

---

## 8. Security Model

- JWT for API auth; role-based access (admin vs farmer).
- Passwords hashed (bcrypt).
- Rate limiting on auth endpoints.
- CORS configurable per environment.
