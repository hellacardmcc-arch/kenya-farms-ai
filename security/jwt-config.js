/** JWT Authentication - Kenya Farm IoT */

export const jwtConfig = {
  algorithm: 'HS256',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'kenya-farm-iot',
  audience: 'kenya-farm-iot-api',
};

export const claims = {
  sub: 'userId',
  role: 'farmer|admin|viewer',
  farmId: 'optional',
  exp: 'expiry',
  iat: 'issued',
};
