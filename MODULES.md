# Module Boundary Rules (Enforced)

Each module MUST remain independent. Violations break the modular system.

## Rules

1. **No cross-service imports** – A service must NOT import code from another service.
2. **Database isolation** – Each service uses only its assigned database(s).
3. **API-only communication** – Services communicate via HTTP/API through the gateway.
4. **Own package.json** – Each service and frontend has its own dependencies.

## Allowed

- Service → its own database
- Frontend → API Gateway (http://localhost:4000/api/*)
- Service → external npm packages

## Forbidden

- Service A → Service B (direct)
- Frontend → Service (bypass gateway)
- Shared code between services (use API contracts instead)
