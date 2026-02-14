INSERT INTO system_config (key, value, description) VALUES
  ('ports', '{"api_gateway": 5001, "auth": 5002, "farmer": 4002, "device": 4003, "analytics": 4004, "notification": 4005, "admin": 4006, "system": 4007}', 'Service ports'),
  ('endpoints', '{"api_gateway": "http://localhost:5001", "auth": "http://localhost:5002", "farmer": "http://localhost:4002", "device": "http://localhost:4003", "analytics": "http://localhost:4004", "notification": "http://localhost:4005", "admin": "http://localhost:4006", "system": "http://localhost:4007"}', 'Service base URLs')
ON CONFLICT (key) DO NOTHING;
