# Deploy Kenya Farms AI on Render.com

This guide walks you through deploying Kenya Farms AI to [Render.com](https://render.com).

## Architecture on Render

| Component | Render Type | Notes |
|-----------|-------------|-------|
| PostgreSQL | Managed Database | Free tier available |
| Redis | Managed Redis | Paid - optional for notifications |
| MongoDB | MongoDB Atlas | Free tier - for devices/analytics |
| API Gateway | Web Service | Entry point for all APIs |
| Auth Service | Web Service | JWT, users |
| Farmer Service | Web Service | Farms, crops |
| Admin Service | Web Service | Admin panel backend |
| System Service | Web Service | Health, config |
| Farmer App | Static Site | React build |
| Admin App | Static Site | React build |

---

## Prerequisites

1. [Render account](https://dashboard.render.com/register)
2. [GitHub repo](https://github.com/hellacardmcc-arch/kenya-farms-ai) connected to Render
3. [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (free tier) - for device/analytics services

---

## Step 1: Create PostgreSQL Database

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **PostgreSQL**
2. Name: `kenya-farms-ai-db`
3. Region: Choose closest to your users
4. Plan: **Free** (or Starter for production)
5. Click **Create Database**
6. Copy the **Internal Database URL** (use this for services on Render)
7. Run migrations manually (see Step 7)

---

## Step 2: Create MongoDB Atlas (Optional)

If you need device/analytics features:

1. Create cluster at [MongoDB Atlas](https://cloud.mongodb.com)
2. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/kenya_farm`
3. Add to Render as **Environment Variable** `MONGODB_URI` in device-service and analytics-service

---

## Step 3: Deploy Backend Services

Deploy in this order (later services depend on earlier ones):

### 3.1 Auth Service

1. **New** → **Web Service**
2. Connect your GitHub repo `kenya-farms-ai`
3. Settings:
   - **Name**: `kenya-farms-auth`
   - **Root Directory**: `services/auth-service`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

4. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `PORT` | 5002 |
   | `DATABASE_URL` | (from PostgreSQL - Internal URL) |
   | `JWT_SECRET` | (generate: `openssl rand -base64 32`) |

5. Deploy. Copy the URL: `https://kenya-farms-auth-xxx.onrender.com`

---

### 3.2 Farmer Service

1. **New** → **Web Service**
2. Connect repo
3. Settings:
   - **Name**: `kenya-farms-farmer`
   - **Root Directory**: `services/farmer-service`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `PORT` | 4002 |
   | `DATABASE_URL` | (PostgreSQL Internal URL) |
   | `JWT_SECRET` | (same as auth-service) |

5. Deploy. Copy URL.

---

### 3.3 Admin Service

1. **New** → **Web Service**
2. Settings:
   - **Name**: `kenya-farms-admin`
   - **Root Directory**: `services/admin-service`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `PORT` | 4006 |
   | `DATABASE_URL` | (PostgreSQL Internal URL) |
   | `NOTIFICATION_SERVICE_URL` | (optional - leave empty or use external) |

4. Deploy. Copy URL.

---

### 3.4 System Service

1. **New** → **Web Service**
2. Settings:
   - **Name**: `kenya-farms-system`
   - **Root Directory**: `services/system-service`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `PORT` | 4007 |
   | `DATABASE_URL` | (PostgreSQL Internal URL) |
   | `JWT_SECRET` | (same as auth) |

4. Deploy. Copy URL.

---

### 3.5 API Gateway

1. **New** → **Web Service**
2. Settings:
   - **Name**: `kenya-farms-api`
   - **Root Directory**: `services/api-gateway`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Environment Variables** (use your actual service URLs):
   | Key | Value |
   |-----|-------|
   | `PORT` | 5001 |
   | `AUTH_SERVICE_URL` | https://kenya-farms-auth-xxx.onrender.com |
   | `FARMER_SERVICE_URL` | https://kenya-farms-farmer-xxx.onrender.com |
   | `ADMIN_SERVICE_URL` | https://kenya-farms-admin-xxx.onrender.com |
   | `SYSTEM_SERVICE_URL` | https://kenya-farms-system-xxx.onrender.com |
   | `JWT_SECRET` | (same as auth) |

4. Deploy. **This is your main API URL**: `https://kenya-farms-api-xxx.onrender.com`

---

## Step 4: Deploy Frontends (Static Sites)

### 4.1 Farmer App

1. **New** → **Static Site**
2. Connect repo
3. Settings:
   - **Name**: `kenya-farms-farmer-app`
   - **Root Directory**: `frontend/farmer-app`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

4. **Environment Variable**:
   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | https://kenya-farms-api-xxx.onrender.com |

5. Deploy. URL: `https://kenya-farms-farmer-app.onrender.com`

---

### 4.2 Admin App

1. **New** → **Static Site**
2. Settings:
   - **Name**: `kenya-farms-admin-app`
   - **Root Directory**: `frontend/admin-app`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`

3. **Environment Variable**:
   | Key | Value |
   |-----|-------|
   | `REACT_APP_API_URL` | https://kenya-farms-api-xxx.onrender.com |

4. Deploy. URL: `https://kenya-farms-admin-app.onrender.com`

---

## Step 5: Run Database Migrations

After PostgreSQL is running:

1. Get the **External Database URL** from Render (for one-time migration from your machine)
2. Run migrations:

```bash
# From project root
cd kenya-farm-iot

# Run each migration (replace YOUR_RENDER_DB_URL with actual URL)
psql "YOUR_RENDER_DB_URL" -f databases/postgres/init.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/001_add_users_name_phone.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/002_add_crops_tasks_alerts.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/003_add_system_tables.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/004_add_soft_delete.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/005_sensor_robot_registration.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/006_system_config.sql
psql "YOUR_RENDER_DB_URL" -f databases/postgres/migrations/007_access_requests.sql
```

Or use Render's **Shell** (Dashboard → PostgreSQL → Connect → Shell) to run SQL manually.

---

## Step 6: Create First Admin User

After migrations, create an admin via API:

```bash
curl -X POST https://kenya-farms-api-xxx.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"YourSecurePassword123","name":"Admin","role":"admin"}'
```

Or use the Admin App registration page (if request-access flow is enabled).

---

## Important Notes

### Free Tier Limits
- **Web Services**: Sleep after 15 min inactivity; cold start ~30–60 sec
- **PostgreSQL**: 90-day limit on free tier, then upgrade or export
- **Static Sites**: Free, no sleep

### CORS
Ensure your API Gateway allows your frontend origins. Update `services/api-gateway/index.js` if needed:

```javascript
app.use(cors({ origin: ['https://kenya-farms-farmer-app.onrender.com', 'https://kenya-farms-admin-app.onrender.com'] }));
```

### Custom Domains
In Render Dashboard → Service → Settings → Custom Domains, add your domain.

### Environment Secrets
Never commit `JWT_SECRET`, `DATABASE_URL`, or passwords. Use Render's Environment tab.

---

## Quick Reference URLs

| App | URL |
|-----|-----|
| Farmer App | https://kenya-farms-farmer-app.onrender.com |
| Admin App | https://kenya-farms-admin-app.onrender.com |
| API Gateway | https://kenya-farms-api-xxx.onrender.com |

---

## Troubleshooting

1. **502 Bad Gateway**: Service still starting (cold start). Wait 1–2 min.
2. **Database connection failed**: Use **Internal Database URL** for services on Render.
3. **CORS errors**: Add frontend URLs to API Gateway CORS config.
4. **Migrations fail**: Ensure `init.sql` runs first; check user has CREATE privileges.
