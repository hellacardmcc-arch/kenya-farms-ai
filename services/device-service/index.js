import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4003;

app.use(cors());
app.use(express.json());

// 15 Device APIs
app.get('/api/devices', (_, res) => res.json({ devices: [] }));
app.get('/api/devices/:id', (req, res) => res.json({ id: req.params.id }));
app.post('/api/devices', (_, res) => res.json({ id: 'd1' }));
app.put('/api/devices/:id', (_, res) => res.json({ ok: true }));
app.delete('/api/devices/:id', (_, res) => res.json({ ok: true }));
app.get('/api/devices/:id/readings', (_, res) => res.json({ readings: [] }));
app.post('/api/devices/:id/readings', (_, res) => res.json({ ok: true }));
app.get('/api/devices/:id/status', (_, res) => res.json({ status: 'online' }));
app.post('/api/devices/:id/command', (_, res) => res.json({ ok: true }));
app.get('/api/devices/farm/:farmId', (_, res) => res.json({ devices: [] }));
app.get('/api/devices/types', (_, res) => res.json({ types: ['sensor', 'actuator'] }));
app.post('/api/devices/bulk', (_, res) => res.json({ created: 0 }));
app.get('/api/devices/:id/history', (_, res) => res.json({ history: [] }));
app.put('/api/devices/:id/calibrate', (_, res) => res.json({ ok: true }));
app.get('/api/devices/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`🇰🇪 Device Service :${PORT}`));
