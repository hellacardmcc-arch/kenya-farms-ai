# MongoDB Scaling

## Architecture

- **Sharding** – By phone number (hashed) for farmer/device data
- **Replica sets** – High availability (3-node minimum)
- **Time-series collections** – Sensor readings, optimized for IoT

## Sharding by Phone Number

```javascript
// Shard key: phone (hashed) - distributes by farmer
sh.shardCollection("kenya_farm_devices.readings", { phone: "hashed" });
sh.shardCollection("kenya_farm_devices.devices", { phone: "hashed" });
```

- Phone number = farmer identifier; even distribution across shards
- Config servers + mongos + shard replicasets

## Replica Sets for HA

```
Primary ──► Secondary 1
    └────► Secondary 2
```

- 3-node replica set per shard
- Automatic failover (10–30s)
- Read preference: `primaryPreferred` for reporting

## Time-Series Collections

```javascript
db.createCollection("readings", {
  timeseries: {
    timeField: "timestamp",
    metaField: "deviceId",
    granularity: "minutes"
  },
  expireAfterSeconds: 7776000  // 90 days retention
});
```

- Optimized for sensor telemetry
- Compression, aggregation pipelines
- Used by device-service and analytics-service
