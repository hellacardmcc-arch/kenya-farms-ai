import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 4005;

app.use(cors());
app.use(express.json());

// Email notification (for access request approval/rejection)
app.post('/api/notifications/email', async (req, res) => {
  const { to, subject, html, text } = req.body || {};
  if (!to || !subject) return res.status(400).json({ error: 'to and subject required' });
  try {
    // In production: use nodemailer with SMTP. For dev: log and return success.
    console.log(`[Email] To: ${to} | Subject: ${subject}`);
    if (process.env.SMTP_HOST) {
      // TODO: integrate nodemailer when SMTP configured
      const nodemailer = await import('nodemailer').catch(() => null);
      if (nodemailer?.default) {
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587', 10),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
        await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@kenyafarmiot.local', to, subject, html: html || text, text });
      }
    }
    res.json({ ok: true, id: 'email-' + Date.now() });
  } catch (err) {
    console.error('[Email]', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// 6 Notification APIs
app.post('/api/notifications/send', (_, res) => res.json({ id: 'n1' }));
app.get('/api/notifications/:userId', (_, res) => res.json({ notifications: [] }));
app.put('/api/notifications/:id/read', (_, res) => res.json({ ok: true }));
app.post('/api/notifications/sms', (_, res) => res.json({ ok: true }));
app.post('/api/notifications/push', (_, res) => res.json({ ok: true }));
app.get('/api/notifications/health', (_, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`🇰🇪 Notification Service :${PORT}`));
