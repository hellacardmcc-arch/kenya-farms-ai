-- Create missing farmer row for a user who exists in users but has no farmers record.
--
-- Run:
--   psql -U kfiot -d kenya_farm_iot -f databases/postgres/scripts/create-missing-farmer.sql
--
-- Or with Docker:
--   docker exec -i kenya-farm-iot-postgres-1 psql -U kfiot -d kenya_farm_iot < databases/postgres/scripts/create-missing-farmer.sql
--
-- To use a different email, replace 'pascaliapendo@gmail.com' below.

INSERT INTO farmers (user_id, name, phone, location)
SELECT u.id, u.name, u.phone, NULL
FROM users u
WHERE u.email = 'pascaliapendo@gmail.com'
  AND u.role = 'farmer'
  AND NOT EXISTS (SELECT 1 FROM farmers f WHERE f.user_id = u.id);

-- Report
SELECT u.email, f.id AS farmer_id, f.name AS farmer_name
FROM users u
LEFT JOIN farmers f ON f.user_id = u.id
WHERE u.email = 'pascaliapendo@gmail.com';
