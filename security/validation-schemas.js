/** Input Validation Schemas - Kenya Farm IoT */

export const loginSchema = {
  email: { type: 'string', format: 'email', maxLength: 255 },
  password: { type: 'string', minLength: 8, maxLength: 128 },
};

export const registerSchema = {
  email: { type: 'string', format: 'email', maxLength: 255 },
  password: { type: 'string', minLength: 8, maxLength: 128 },
  name: { type: 'string', maxLength: 255 },
  phone: { type: 'string', pattern: '^\\+?[0-9]{10,15}$', maxLength: 20 },
};

export const deviceCommandSchema = {
  value: { type: ['number', 'boolean', 'string'], maxLength: 1000 },
};

export const maxPayloadSize = 1024 * 100; // 100KB
