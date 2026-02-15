# Kenya Farms AI - Installation & Infrastructure Requirements

**Version 2.0.0**

---

## 1. System Requirements

### Minimum (Development)

| Resource | Requirement |
|---------|-------------|
| CPU | 2 cores |
| RAM | 4 GB |
| Disk | 10 GB free |
| OS | Windows 10+, macOS 10.15+, Ubuntu 20.04+ |

### Recommended (Production)

| Resource | Requirement |
|---------|-------------|
| CPU | 4+ cores |
| RAM | 8+ GB |
| Disk | 50+ GB SSD |
| OS | Linux (Ubuntu 22.04 LTS) |

---

## 2. Software Requirements

| Software | Version | Required For |
|----------|---------|--------------|
| Node.js | 18.x or 20.x LTS | All services |
| npm | 9+ | Package management |
| Docker | 20.10+ | Containerized deployment |
| Docker Compose | 2.x | Multi-container orchestration |
| PostgreSQL | 15+ | Primary database |
| MongoDB | 7.x | Device/analytics (optional) |
| Redis | 7.x | Notifications (optional) |
| Git | 2.x | Version control |

---

## 3. Port Allocation

| Service | Port | Protocol |
|---------|------|----------|
| API Gateway | 5001 | HTTP |
| Auth Service | 5002 | HTTP |
| Farmer Service | 4002 | HTTP |
| Device Service | 4003 | HTTP |
| Analytics Service | 4004 | HTTP |
| Notification Service | 4005 | HTTP |
| Admin Service | 4006 | HTTP |
| System Service | 4007 | HTTP |
| PostgreSQL | 5432 | TCP |
| MongoDB | 27017 | TCP |
| Redis | 6379 | TCP |
| Farmer App | 3000 | HTTP |
| Admin App | 3000 | HTTP |
| Public App | 4001 | HTTP |

---

## 4. Network Requirements

- **Outbound**: All services need internet for npm, Docker pulls
- **Inbound**: Expose API Gateway (5001) and frontends for production
- **Internal**: Services communicate over Docker network or localhost

---

## 5. Local Installation (Docker)

### Step 1: Install Docker

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (Windows/Mac)
- Or Docker Engine + Docker Compose (Linux)

### Step 2: Clone & Start

```bash
git clone https://github.com/hellacardmcc-arch/kenya-farms-ai.git
cd kenya-farms-ai
docker-compose up -d
```

### Step 3: Run Migrations

Use Admin App → Settings → Maintenance → **Run Full Database Migrations**, or run manually via psql.

### Step 4: Create Admin User

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourPassword123","name":"Admin","role":"admin"}'
```

---

## 6. Cloud Deployment (Render.com)

See [deploy/RENDER.md](../deploy/RENDER.md) for full guide.

### Infrastructure Summary

| Component | Render Type | Notes |
|-----------|-------------|-------|
| PostgreSQL | Managed Database | Free tier 90 days |
| API Gateway | Web Service | Free tier (sleeps) |
| Auth Service | Web Service | Free tier |
| Farmer Service | Web Service | Free tier |
| Admin Service | Web Service | Free tier |
| System Service | Web Service | Free tier |
| Farmer App | Static Site | Free |
| Admin App | Static Site | Free |
| MongoDB | MongoDB Atlas | External, free tier |
| Redis | Managed Redis | Paid (optional) |

---

## 7. Environment Variables Reference

### API Gateway

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 5001 | Listen port |
| AUTH_SERVICE_URL | Yes* | - | Auth service URL |
| FARMER_SERVICE_URL | Yes* | - | Farmer service URL |
| ADMIN_SERVICE_URL | Yes* | - | Admin service URL |
| SYSTEM_SERVICE_URL | Yes* | - | System service URL |
| JWT_SECRET | No | dev-secret | JWT signing key |

*Required in production; Docker Compose sets defaults.

### Auth Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 5002 | Listen port |
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| JWT_SECRET | No | dev-secret | JWT signing key |

### Admin Service

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 4006 | Listen port |
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| COMPOSE_PROJECT_DIR | No | - | For rebuild/migrations from UI |
| MIGRATIONS_DIR | No | - | Path to migration SQL files |

### Frontend Apps

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| REACT_APP_API_URL | Yes (prod) | http://localhost:5001 | API Gateway URL |
| PORT | No | 3000 | Dev server port |

---

## 8. Database Sizing

| Database | Dev | Small Prod | Large Prod |
|----------|-----|------------|------------|
| PostgreSQL | 1 GB | 10 GB | 100+ GB |
| MongoDB | 512 MB | 5 GB | 50+ GB |
| Redis | 256 MB | 1 GB | 4+ GB |

---

## 9. Backup Requirements

- **PostgreSQL**: Daily backups recommended
- **MongoDB**: Atlas automated backups or manual dump
- **Redis**: Persistence (RDB/AOF) for critical data

---

## 10. Security Checklist

- [ ] Change `JWT_SECRET` in production
- [ ] Use strong `POSTGRES_PASSWORD`
- [ ] Enable HTTPS (TLS) in production
- [ ] Restrict database access (firewall/VPC)
- [ ] Use Internal Database URL on Render (not External)
- [ ] Never commit secrets to Git
