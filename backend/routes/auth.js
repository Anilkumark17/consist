import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { claimWorkForUser } from '../lib/matching.js';
import { clearAuthCookie, publicUser, requireAuth, setAuthCookie } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: 'Name must be 2–80 characters' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash })
      .returning({ id: users.id, name: users.name, email: users.email });

    setAuthCookie(res, user);
    await claimWorkForUser(user);
    res.status(201).json({ user });
  } catch (error) {
    if (error?.cause?.code === '23505' || error?.code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('Register failed:', error);
    res.status(500).json({ error: 'Could not create account' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    setAuthCookie(res, user);
    await claimWorkForUser(user);
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Could not sign in' });
  }
});

router.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Sign in required' });
    }
    res.json({ user });
  } catch (error) {
    console.error('Session lookup failed:', error);
    res.status(500).json({ error: 'Could not load session' });
  }
});

export default router;
