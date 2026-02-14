# Redis Scaling

## Architecture

- **Redis Cluster** – Sharding across nodes, high availability
- **Sentinel** – Automatic failover when master goes down
- **Persistence** – AOF + RDB for durability

## Redis Cluster for HA

```
[Master 1]──[Slave 1]   [Master 2]──[Slave 2]   [Master 3]──[Slave 3]
     │           │           │           │           │           │
     └───────────┴───────────┴───────────┴───────────┴───────────┘
                          Redis Cluster
```

- 6 nodes minimum (3 masters, 3 replicas)
- Automatic sharding by hash slot
- Clients use cluster-aware driver (e.g. ioredis with `cluster: true`)

## Sentinel for Failover

```
[Master] ◄── [Sentinel 1]
   │     ◄── [Sentinel 2]
   │     ◄── [Sentinel 3]
   ▼
[Replica] (promoted on failover)
```

- 3+ Sentinel nodes monitor master
- Automatic promotion of replica on failure
- Clients connect via Sentinel for current master address

## Persistence: AOF + RDB

**redis.conf** (see `redis.conf`):

- **RDB** – Point-in-time snapshots (e.g. every 5 min)
- **AOF** – Append-only log for durability
- **appendonly yes** + **appendfsync everysec**
- Hybrid: RDB for base + AOF for incremental
