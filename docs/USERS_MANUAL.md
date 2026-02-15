# Kenya Farms AI - Users Manual

**Version 2.0.0**

---

## 1. Overview

Kenya Farms AI provides three web applications:

| App | URL (Local) | For |
|-----|-------------|-----|
| **Admin App** | http://localhost:3000 | Administrators |
| **Farmer App** | http://localhost:3001 | Farmers |
| **Public App** | http://localhost:4001 | General public |

---

## 2. For Administrators

### 2.1 Logging In

1. Open the Admin App (e.g. http://localhost:3000).
2. Enter your admin email and password.
3. Click **Login**.

If you don't have an account, ask another admin to approve your access request (see **Request Access** below).

### 2.2 Request Access (New Admin)

1. Click **Request Access** on the login page.
2. Fill in: Email, Password, Name, Phone, Role (Admin).
3. Submit. An existing admin will review and approve or reject.

### 2.3 Dashboard

- View farmers, crops, sensors, and robots.
- Quick links to manage each section.

### 2.4 Managing Farmers

- **List**: View all farmers.
- **Register**: Add a farmer directly (skips approval).
- **Edit**: Update farmer details.
- **Delete / Restore**: Soft delete or restore farmers.

### 2.5 Managing Crops

- **List**: View all crops.
- **Add**: Create new crop types.
- **Edit / Delete**: Update or remove crops.

### 2.6 Managing Access Requests

- **List**: View pending farmer/admin signup requests.
- **Approve**: Create user account and notify.
- **Reject**: Decline with optional message.

### 2.7 Sensors & Robots

- **Register**: Add new sensors or robots.
- **Initialize / Configure**: Set up devices.
- **Edit / Delete**: Update or remove devices.

### 2.8 Settings

- **Ports & Endpoints**: Configure service ports and API endpoints.
- **Seed defaults**: Use **Seed default ports & endpoints** if config is empty.

### 2.9 Maintenance

- **Force Reconnect DB**: Use when DB is disconnected.
- **Run Full Database Migrations**: Apply all migrations.
- **Check Migration Status**: See which migrations are applied.
- **Rebuild & Restart Service**: Rebuild a Docker service with `--no-cache`.
- **Restart System**: Restart all services.

---

## 3. For Farmers

### 3.1 Request Access

1. Open the Farmer App (e.g. http://localhost:3001).
2. Click **Request Access**.
3. Fill in: Email, Password, Name, Phone, Farm Name, Farm Size, optional message.
4. Submit. An admin will approve or reject.

### 3.2 Logging In

1. After approval, open the Farmer App.
2. Enter your email and password.
3. Click **Login**.

### 3.3 Dashboard

- View your farms, crops, sensors, and robots.
- See alerts and quick actions.

### 3.4 Farms & Crops

- Add and manage farms.
- Add crops to farms.
- View crop status and recommendations.

### 3.5 Sensors & Robots

- **Available**: See sensors/robots you can activate.
- **Activate**: Assign a sensor or robot to your farm.
- **Control**: Start/stop irrigation, send robot commands.

### 3.6 Profile

- Update name and phone.
- Change password.

---

## 4. For Public Users

### 4.1 Public App

- Browse general information about Kenya Farms AI.
- No login required.
- View features, contact info, and links to Farmer/Admin apps.

---

## 5. Common Tasks

| Task | Where | Steps |
|------|-------|-------|
| Change password | Profile (Admin/Farmer) | Profile → Change Password |
| Add a farmer | Admin → Farmers | Register Farmer |
| Approve signup | Admin → Access Requests | Approve |
| Run migrations | Admin → Maintenance | Run Full Database Migrations |
| Reconnect DB | Admin → Maintenance | Force Reconnect DB |
| Activate sensor | Farmer → Sensors | Activate |

---

## 6. Troubleshooting

- **Can't log in**: Verify email/password; check if access was approved.
- **"Request failed"**: Check internet; try again; contact admin if persistent.
- **DB disconnected**: Admin uses **Force Reconnect DB** on Maintenance page.
- **No config / empty settings**: Admin runs **Seed default ports & endpoints** or **Run Full Database Migrations**.

For technical issues, see `docs/MAINTENANCE_AND_TROUBLESHOOTING.md`.
