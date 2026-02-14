# PostgreSQL Scaling

## Architecture

- **Primary** – Writes, transactional queries
- **Read replicas** – Reporting, analytics, dashboards
- **PgBouncer** – Connection pooling (transaction mode)
- **Partitioning** – Logs by date (RANGE)

## Read Replicas for Reporting

```
Primary (5432) ──streaming──► Replica 1 (5433) ──► Reporting queries
                         └──► Replica 2 (5434) ──► Analytics
```

- Use `DATABASE_READ_URL` for read-only workloads
- Replicas receive streaming replication from primary
- Services: auth, farmer, admin → primary for writes; analytics-service → replica for reports

## Connection Pooling with PgBouncer

```
Services ──► PgBouncer (6432) ──► PostgreSQL Primary
```

- **pool_mode**: transaction
- **max_client_conn**: 1000
- **default_pool_size**: 25 per database

Config: `pgbouncer.ini`

## Partitioning by Date for Logs

```sql
-- audit_logs partitioned by month
CREATE TABLE audit_logs (
  id UUID,
  action VARCHAR(50),
  user_id UUID,
  created_at TIMESTAMPTZ,
  metadata JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE audit_logs_2025_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... monthly partitions
```

- Enables efficient pruning for time-range queries
- Simplifies archival (detach old partitions)
