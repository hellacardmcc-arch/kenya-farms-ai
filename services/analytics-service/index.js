import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4004;

app.use(cors());
app.use(express.json());

// 8 Analytics APIs
app.get('/api/analytics/dashboard', (_, res) => res.json({ summary: {} }));
app.get('/api/analytics/farm/:farmId', (_, res) => res.json({ data: [] }));
app.get('/api/analytics/device/:deviceId', (_, res) => res.json({ data: [] }));
app.get('/api/analytics/reports', (_, res) => res.json({ reports: [] }));
app.post('/api/analytics/reports', (_, res) => res.json({ id: 'r1' }));
app.get('/api/analytics/trends', (_, res) => res.json({ trends: [] }));
app.get('/api/analytics/export', (_, res) => res.json({ url: '/export.csv' }));
app.get('/api/analytics/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`🇰🇪 Analytics Service :${PORT}`));
