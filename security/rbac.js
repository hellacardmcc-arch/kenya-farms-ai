/** Role-Based Access Control - Kenya Farm IoT */

export const ROLES = {
  FARMER: 'farmer',
  ADMIN: 'admin',
  VIEWER: 'viewer',
};

export const PERMISSIONS = {
  [ROLES.FARMER]: [
    'farms:read', 'farms:write', 'devices:read', 'devices:write',
    'analytics:read', 'notifications:read', 'profile:read', 'profile:write',
  ],
  [ROLES.ADMIN]: [
    'farms:*', 'devices:*', 'analytics:*', 'notifications:*',
    'users:*', 'admin:*', 'system:*',
  ],
  [ROLES.VIEWER]: [
    'farms:read', 'devices:read', 'analytics:read',
  ],
};

export function hasPermission(role, permission) {
  const perms = PERMISSIONS[role] || [];
  const [resource, action] = permission.split(':');
  return perms.some((p) => {
    const [r, a] = p.split(':');
    return (r === resource || r === '*') && (a === action || a === '*');
  });
}
