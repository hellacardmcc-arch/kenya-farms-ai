/** Input Validation - Parameterized queries only (SQL injection prevention) */

export function validateBody(schema) {
  return (req, res, next) => {
    const { body } = req;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'Invalid body' });
    }
    for (const [key, rules] of Object.entries(schema)) {
      const val = body[key];
      if (rules.required && (val === undefined || val === null)) {
        return res.status(400).json({ error: `Missing required field: ${key}` });
      }
      if (val !== undefined && rules.maxLength && String(val).length > rules.maxLength) {
        return res.status(400).json({ error: `Field ${key} exceeds max length` });
      }
    }
    next();
  };
}

export const MAX_PAYLOAD = 100 * 1024; // 100KB
