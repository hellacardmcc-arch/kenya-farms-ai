/** JWT + RBAC Middleware - Auth Service */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const PERMISSIONS = {
  farmer: ['farms:read', 'farms:write', 'devices:read', 'devices:write', 'analytics:read', 'notifications:read', 'profile:read', 'profile:write'],
  admin: ['farms:*', 'devices:*', 'analytics:*', 'notifications:*', 'users:*', 'admin:*', 'system:*'],
  viewer: ['farms:read', 'devices:read', 'analytics:read'],
};

function hasPermission(role, permission) {
  const perms = PERMISSIONS[role] || [];
  const [resource, action] = permission.split(':');
  return perms.some((p) => {
    const [r, a] = p.split(':');
    return (r === resource || r === '*') && (a === action || a === '*');
  });
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
