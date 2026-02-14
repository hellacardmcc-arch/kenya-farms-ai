# Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    HTTPS/TLS 1.3                       │
├─────────────────────────────────────────────────────────┤
│                 API Gateway (Rate Limiting)             │
├─────────────────────────────────────────────────────────┤
│                    JWT Authentication                  │
├─────────────────────────────────────────────────────────┤
│                 Role-Based Access Control               │
├─────────────────────────────────────────────────────────┤
│                   Input Validation                      │
├─────────────────────────────────────────────────────────┤
│                  SQL Injection Prevention              │
├─────────────────────────────────────────────────────────┤
│                      Data Encryption                    │
└─────────────────────────────────────────────────────────┘
```

## 1. HTTPS/TLS 1.3

- **Termination**: Reverse proxy (nginx/traefik) terminates TLS before API Gateway
- **Min version**: TLS 1.3 only in production
- **Certificates**: Let's Encrypt or ACM
- **HSTS**: `Strict-Transport-Security` header enabled

Config: `security/tls.conf`

## 2. API Gateway (Rate Limiting)

- **Global**: 100 req/min per IP
- **Auth endpoints**: 5 req/min (login, register)
- **API endpoints**: 60 req/min per user (post-JWT)

Config: `services/api-gateway` (express-rate-limit)

## 3. JWT Authentication

- **Algorithm**: RS256 or HS256
- **Access token**: 15 min expiry
- **Refresh token**: 7 days, stored in httpOnly cookie
- **Claims**: `sub`, `role`, `farmId`, `exp`, `iat`

Config: `services/auth-service`, `security/jwt-config.js`

## 4. Role-Based Access Control (RBAC)

| Role    | Access                                      |
|---------|---------------------------------------------|
| farmer  | Own farms, devices, analytics                |
| admin   | All farms, users, system config              |
| viewer  | Read-only dashboards                         |

Middleware: `security/rbac.js`

## 5. Input Validation

- **Schema**: JSON Schema or Joi/Zod
- **Sanitization**: Escape HTML, trim, max length
- **Reject**: Unknown fields, oversized payloads

Config: `security/validation-schemas.js`

## 6. SQL Injection Prevention

- **Parameterized queries only** – No string concatenation
- **ORM/Query builder**: pg with `$1`, `$2` placeholders
- **MongoDB**: Use driver methods, no `$where` with user input

Enforced in: auth-service, farmer-service, admin-service

## 7. Data Encryption

- **At rest**: Database encryption (PostgreSQL TDE, MongoDB encryption)
- **In transit**: TLS 1.3
- **Sensitive fields**: AES-256-GCM for PII (phone, email hash)

Config: `security/encryption.js`

---

## Quick Reference

| Layer | Location |
|-------|----------|
| TLS | nginx / `security/tls.conf` |
| Rate limit | `services/api-gateway/index.js` |
| JWT | `services/auth-service/middleware/auth.js` |
| RBAC | `security/rbac.js` |
| Validation | `security/validation-schemas.js`, `services/*/middleware/validation.js` |
| SQL injection | `databases/postgres/sql-injection-prevention.md` |
| Encryption | `security/encryption.js` |
