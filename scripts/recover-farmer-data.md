# Recover Farmer Data from Stopped Postgres Container

## What Happened

1. **Before:** A Postgres container named `postgres` was running on port 5432 with your farmer data.
2. **You ran:** `docker stop postgres` then `docker-compose up -d`
3. **Result:** The `postgres` container (with your data) was stopped. `kenya-farm-iot-postgres-1` started and uses a **different, empty volume**.

Your data is still in the stopped `postgres` container's volume. It was not deleted.

## Recovery Steps

### Option A: Switch back to the old Postgres (simplest)

1. Stop the current Postgres:
   ```
   docker stop kenya-farm-iot-postgres-1
   ```

2. Start the old Postgres (with your data):
   ```
   docker start postgres
   ```

3. Verify: Run `node services/admin-service/scripts/check-farmer-users.js` – your farmer data should be back.

4. **Note:** The old `postgres` container may be from another project. If its database name/user differ from `kenya_farm_iot`/`kfiot`, the app may not connect. Check with:
   ```
   docker exec postgres psql -U postgres -c "\l"
   ```

### Option B: Copy data from old to new Postgres

1. Stop kenya-farm-iot postgres:
   ```
   docker stop kenya-farm-iot-postgres-1
   ```

2. Start the old postgres:
   ```
   docker start postgres
   ```

3. Export data (adjust if DB name/user differ):
   ```
   docker exec postgres pg_dump -U kfiot kenya_farm_iot -t users -t farmers -t farms --data-only > farmer_backup.sql
   ```

4. Stop old, start new:
   ```
   docker stop postgres
   docker start kenya-farm-iot-postgres-1
   ```

5. Wait ~10 seconds for Postgres to be ready, then import:
   ```
   docker exec -i kenya-farm-iot-postgres-1 psql -U kfiot kenya_farm_iot < farmer_backup.sql
   ```

### Option C: Use the old Postgres as the main DB

If the old `postgres` container has the correct schema and data:

1. Stop kenya-farm-iot-postgres-1
2. Start postgres
3. Point your app at it (it will use localhost:5432)

## Prevent Future Data Loss

Add a **named volume** to `docker-compose.yml` for Postgres so data persists:

```yaml
postgres:
  image: postgres:15-alpine
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./databases/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
  # ... rest of config

volumes:
  postgres_data:
```

Then `docker-compose down` and `up` will keep your data.
