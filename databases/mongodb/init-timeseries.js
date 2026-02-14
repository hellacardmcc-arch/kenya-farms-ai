// Time-series collections for Kenya Farm IoT
// Run: mongosh kenya_farm_devices < init-timeseries.js

db.createCollection("readings", {
  timeseries: {
    timeField: "timestamp",
    metaField: "deviceId",
    granularity: "minutes"
  },
  expireAfterSeconds: 7776000  // 90 days
});

db.createCollection("analytics_aggregates", {
  timeseries: {
    timeField: "period",
    metaField: "farmId",
    granularity: "hours"
  }
});
