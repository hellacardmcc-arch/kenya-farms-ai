# 🇰🇪 Kenya Farms AI - Complete Modular System

**Version 2.1.0** | [GitHub](https://github.com/hellacardmcc-arch/kenya-farms-ai)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│     🇰🇪  KENYA FARMS AI - COMPLETE MODULAR SYSTEM          │
│                                                             │
│         ✅ 7 Microservices   ✅ 3 Databases                │
│         ✅ 3 Frontends      ✅ 50+ APIs                   │
│         ✅ Zero-Downtime    ✅ Independent Modules         │
│         ✅ Production Ready ✅ Kenyan Made 🇰🇪             │
│                                                             │
│              Empowering Kenyan Farmers                      │
│              with Smart Farming Technology                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Structure

```
kenya-farm-iot/
├── services/              # 7 Microservices
│   ├── api-gateway/       # :4000 - Routing
│   ├── auth-service/      # :4001 - Users, JWT
│   ├── farmer-service/   # :4002 - Farms, farmers
│   ├── device-service/   # :4003 - IoT devices
│   ├── analytics-service/# :4004 - Reports
│   ├── notification-service/ # :4005 - Alerts
│   └── admin-service/    # :4006 - System config
├── frontend/              # 3 Frontends
│   ├── farmer-app/       # :3000
│   ├── admin-app/        # :3001
│   └── public-app/       # :3002
├── databases/             # 3 Databases
│   ├── postgres/
│   ├── mongodb/
│   └── redis/
├── docker-compose.yml
├── ARCHITECTURE.md
├── MODULES.md
└── README.md
```

## Quick Start

### Install all

```bash
npm run install:all
```

### Run dev (services + farmer app)

```bash
npm run dev
```

Starts backend services and farmer app. Farmer app at http://localhost:3000.

### Run services only

```bash
npm run dev:services
```

### Run frontends

```bash
# Terminal 1
npm run dev:farmer-app

# Terminal 2
npm run dev:admin-app

# Terminal 3
npm run dev:public-app

# Exact Preview (Code + Styling + Data + Logic → Exact Preview)
npm run dev:preview
```

Opens at http://localhost:3010 – edit `frontend/preview-app/src/` and see changes instantly.

### Deploy on Render.com

1. Connect your repo at [Render Dashboard](https://dashboard.render.com/select-repo?type=blueprint)
2. Select **Blueprint** and point to this repo
3. After deploy, add env vars in Dashboard:
   - **API Gateway**: `AUTH_SERVICE_URL`, `FARMER_SERVICE_URL`, `ADMIN_SERVICE_URL`, `SYSTEM_SERVICE_URL` (use each service's Render URL)
   - **Farmer & Admin apps**: `REACT_APP_API_URL` = your API Gateway URL (e.g. `https://kenya-farms-api-xxx.onrender.com`)
4. Run [database migrations](deploy/RENDER.md#step-5-run-database-migrations)

Full guide: [deploy/RENDER.md](deploy/RENDER.md)

### Docker (production)

```bash
docker-compose up -d
```

### Scaled databases (replicas, pooling, HA)

```bash
docker-compose -f docker-compose.scale.yml up -d
```

- **PostgreSQL**: Primary + read replica + PgBouncer (port 6432)
- **MongoDB**: 3-node replica set
- **Redis**: Master + replica + Sentinel

## API Gateway

All APIs go through **http://localhost:4000**:

- `GET /health` - Health check
- `/api/auth/*` - Auth (8 APIs)
- `/api/farmers/*` - Farmers (12 APIs)
- `/api/devices/*` - Devices (15 APIs)
- `/api/analytics/*` - Analytics (8 APIs)
- `/api/notifications/*` - Notifications (6 APIs)
- `/api/admin/*` - Admin (10 APIs)

**Total: 61 APIs**

## Security

7-layer security architecture. See [SECURITY.md](./SECURITY.md):

1. HTTPS/TLS 1.3
2. API Gateway (rate limiting)
3. JWT authentication
4. Role-based access control (RBAC)
5. Input validation
6. SQL injection prevention
7. Data encryption

## Module Boundaries

See [MODULES.md](./MODULES.md) for enforced rules. Each service is independent—deploy and scale separately.
