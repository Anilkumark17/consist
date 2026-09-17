import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listAccounts } from '../lib/matching.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  try {
    const users = await listAccounts();
    res.json({ users });
  } catch (error) {
    console.error('List users failed:', error);
    res.status(500).json({ error: 'Could not load teammates' });
  }
});

export default router;
