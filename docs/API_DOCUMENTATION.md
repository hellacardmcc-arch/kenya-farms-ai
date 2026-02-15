# Kenya Farms AI - API Documentation

**Version 2.0.0** | Base URL: `http://localhost:5001` (or your API Gateway URL)

---

## 1. Overview

All APIs are accessed through the **API Gateway**. Requests are proxied to the appropriate microservice.

### Authentication

Most endpoints require a JWT token:

```
Authorization: Bearer <your-jwt-token>
```

Obtain a token via `POST /api/auth/login` or `POST /api/auth/request-access`.

---

## 2. Auth API (`/api/auth/*`)

### POST /api/auth/request-access

Request farmer or admin access (approval flow).

**Request:**
```json
{
  "email": "farmer@example.com",
  "password": "SecurePass123",
  "name": "John Doe",
  "phone": "+254712345678",
  "role": "farmer",
  "farm_name": "Green Valley Farm",
  "farm_size": 5.2,
  "message": "Optional message"
}
```

**Response (201):**
```json
{
  "ok": true,
  "message": "Request submitted. You will receive an email once an admin reviews it."
}
```

**Errors:** 400 (validation), 409 (email exists or pending)

---

### POST /api/auth/register

Direct registration (legacy, no approval).

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "User Name",
  "phone": "+254712345678",
  "role": "farmer"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "farmer"
  }
}
```

---

### POST /api/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "farmer"
  }
}
```

**Errors:** 401 (invalid credentials)

---

### GET /api/auth/me

Get current user. **Requires:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    "phone": "+254712345678",
    "role": "farmer"
  }
}
```

---

### PUT /api/auth/profile

Update profile. **Requires:** Auth

**Request:**
```json
{
  "name": "New Name",
  "phone": "+254798765432"
}
```

---

### PUT /api/auth/password

Change password. **Requires:** Auth

**Request:**
```json
{
  "currentPassword": "OldPass123",
  "newPassword": "NewPass456"
}
```

---

### GET /api/auth/health

Health check (no auth).

**Response (200):**
```json
{
  "status": "ok",
  "db": "connected"
}
```

---

## 3. Admin API (`/api/admin/*`)

All admin endpoints require `Authorization: Bearer <token>` with admin role.

### Farmers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/farmers | List farmers |
| GET | /api/admin/farmers/:id | Get farmer |
| POST | /api/admin/farmers/register | Register farmer directly |
| PUT | /api/admin/farmers/:id | Update farmer |
| DELETE | /api/admin/farmers/:id | Soft delete farmer |
| POST | /api/admin/farmers/:id/restore | Restore deleted farmer |

### Crops

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/crops | List crops |
| POST | /api/admin/crops | Create crop |
| PUT | /api/admin/crops/:id | Update crop |
| DELETE | /api/admin/crops/:id | Soft delete crop |
| POST | /api/admin/crops/:id/restore | Restore crop |

### Access Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/requests?status=pending | List access requests |
| POST | /api/admin/requests/:id/approve | Approve request |
| POST | /api/admin/requests/:id/reject | Reject request |

### Sensors & Robots

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/sensors | List sensors |
| POST | /api/admin/sensors/register | Register sensor |
| POST | /api/admin/sensors/:id/initialize | Initialize sensor |
| POST | /api/admin/sensors/:id/configure | Configure sensor |
| PUT | /api/admin/sensors/:id | Update sensor |
| DELETE | /api/admin/sensors/:id | Delete sensor |

Same pattern for `/api/admin/robots/*`.

### Settings & Maintenance

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/settings/config | Get ports/endpoints config |
| PUT | /api/admin/settings/config | Update config |
| POST | /api/admin/settings/seed-config | Seed default ports/endpoints |
| GET | /api/admin/settings/logs | Get system logs |
| POST | /api/admin/settings/logs | Add log entry |
| GET | /api/admin/settings/migration-status | Check which migrations applied |
| POST | /api/admin/settings/run-migrations | Run all migrations |
| POST | /api/admin/settings/reconnect-db | Force DB reconnect |
| POST | /api/admin/settings/rebuild-service | Rebuild Docker service |
| POST | /api/admin/settings/restart | Request system restart |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/health | DB health check |
| GET | /api/admin/system/health-details | CPU, RAM, disk, services |

---

## 4. System API (`/api/system/*`)

### Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/system/config | Get system config |
| GET | /api/system/status | System status |
| GET | /api/system/health | Health check |

### Farmer (auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/system/available-sensors | Sensors available for activation |
| GET | /api/system/available-robots | Robots available for activation |
| GET | /api/system/sensors | Farmer's sensors |
| GET | /api/system/robots | Farmer's robots |
| POST | /api/system/sensors/:id/activate | Activate sensor |
| POST | /api/system/robots/:id/activate | Activate robot |
| POST | /api/system/control/irrigation | Start/stop irrigation |
| POST | /api/system/robots/:id/command | Send robot command |

---

## 5. Farmer API (`/api/farmers/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/farmers/me | Current farmer profile |
| GET | /api/farmers | List farmers |
| GET | /api/farmers/:id | Get farmer |
| GET | /api/farmers/:id/farms | Farmer's farms |
| GET | /api/farmers/:id/crops | Farmer's crops |
| GET | /api/farmers/:id/alerts | Farmer's alerts |

---

## 6. Devices API (`/api/devices/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/devices | List devices |
| GET | /api/devices/:id | Get device |
| POST | /api/devices | Create device |
| GET | /api/devices/:id/readings | Device readings |
| POST | /api/devices/:id/readings | Add reading |
| GET | /api/devices/health | Health check |

---

## 7. Analytics API (`/api/analytics/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/analytics/dashboard | Dashboard summary |
| GET | /api/analytics/farm/:farmId | Farm analytics |
| GET | /api/analytics/reports | Reports |
| GET | /api/analytics/health | Health check |

---

## 8. Notifications API (`/api/notifications/*`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/notifications/email | Send email |
| POST | /api/notifications/sms | Send SMS |
| POST | /api/notifications/push | Push notification |
| GET | /api/notifications/:userId | User notifications |

---

## 9. Error Responses

| Status | Format |
|--------|--------|
| 400 | `{ "error": "Validation message" }` |
| 401 | `{ "error": "Unauthorized" }` or `{ "error": "Invalid credentials" }` |
| 403 | `{ "error": "Forbidden" }` |
| 404 | `{ "error": "Not found" }` |
| 409 | `{ "error": "Conflict message" }` |
| 500 | `{ "error": "Internal error" }` |
| 503 | `{ "status": "error", "db": "disconnected" }` |

---

## 10. Rate Limits

- **Global**: 100 requests/minute
- **Auth** (login, register, request-access): 5 requests/minute

---

## 11. CORS

API Gateway allows all origins by default. For production, restrict to your frontend domains.
