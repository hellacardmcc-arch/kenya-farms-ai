-- Migration 013: Fix orphan farmers - create farmers rows for users with role 'farmer' that don't have one
-- Run this if farmers can't login because they have a users row but no farmers row

INSERT INTO farmers (user_id, name, phone, location)
SELECT u.id, u.name, u.phone, NULL
FROM users u
LEFT JOIN farmers f ON f.user_id = u.id
WHERE u.role = 'farmer' AND f.id IS NULL;
