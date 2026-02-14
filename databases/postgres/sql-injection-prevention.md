# SQL Injection Prevention

## Rules (Enforced)

1. **Parameterized queries only** – Use `$1`, `$2` placeholders
2. **No string concatenation** – Never build SQL with user input
3. **Use pg client** – `client.query('SELECT * FROM users WHERE id = $1', [id])`

## Example (Correct)

```javascript
const result = await client.query(
  'SELECT * FROM farmers WHERE user_id = $1 AND region = $2',
  [userId, region]
);
```

## Example (Forbidden)

```javascript
// NEVER DO THIS
const sql = `SELECT * FROM farmers WHERE id = '${req.params.id}'`;
```

## Services Using PostgreSQL

- auth-service
- farmer-service
- admin-service
