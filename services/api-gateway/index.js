import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5001;

app.use(cors());

// Rate limiting - API Gateway layer
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' },
});
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many auth attempts' },
});

app.use(globalLimiter);

// Health & version (no auth)
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'api-gateway' }));
app.get('/version', (_, res) => res.json({ version: '1.0.0', system: 'Kenya Farm IoT' }));

// Stricter rate limit for auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/request-access', authLimiter);

// JWT verification middleware (optional - services can also verify)
const jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const optionalAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(auth.slice(7), jwtSecret);
    } catch (_) {}
  }
  next();
};
app.use('/api', optionalAuth);

const targets = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:5002',
  farmers: process.env.FARMER_SERVICE_URL || 'http://localhost:4002',
  devices: process.env.DEVICE_SERVICE_URL || 'http://localhost:4003',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4004',
  notifications: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4005',
  admin: process.env.ADMIN_SERVICE_URL || 'http://localhost:4006',
  system: process.env.SYSTEM_SERVICE_URL || 'http://localhost:4007',
};

app.use('/api/auth', createProxyMiddleware({ target: targets.auth, changeOrigin: true }));
app.use('/api/farmers', createProxyMiddleware({ target: targets.farmers, changeOrigin: true }));
app.use('/api/devices', createProxyMiddleware({ target: targets.devices, changeOrigin: true }));
app.use('/api/analytics', createProxyMiddleware({ target: targets.analytics, changeOrigin: true }));
app.use('/api/notifications', createProxyMiddleware({ target: targets.notifications, changeOrigin: true }));
app.use('/api/admin', createProxyMiddleware({ target: targets.admin, changeOrigin: true }));
app.use('/api/system', createProxyMiddleware({ target: targets.system, changeOrigin: true }));

app.listen(PORT, () => console.log(`🇰🇪 API Gateway :${PORT}`));
