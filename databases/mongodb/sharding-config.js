// MongoDB sharding config - shard by phone number
// Run in mongos shell after replica sets are up

sh.enableSharding("kenya_farm_devices");
sh.shardCollection("kenya_farm_devices.readings", { phone: "hashed" });
sh.shardCollection("kenya_farm_devices.devices", { phone: "hashed" });

sh.enableSharding("kenya_farm_analytics");
sh.shardCollection("kenya_farm_analytics.reports", { phone: "hashed" });
