import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import meetingRoutes from './routes/meetings.js';
import actionRoutes from './routes/actions.js';
import projectRoutes from './routes/projects.js';
import userRoutes from './routes/users.js';

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment`);
    process.exit(1);
  }
}

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'consist' });
});

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/users', userRoutes);

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(port, () => {
  console.log(`Consist API listening on http://localhost:${port}`);
});
