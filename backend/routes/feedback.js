import { Router } from 'express';
import * as repo from '../db/repo.js';

const router = Router();

router.post('/feedback', async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
    const itemId = typeof body.itemId === 'string' ? body.itemId.trim() : '';
    const vote = body.vote === 'up' || body.vote === 'down' ? body.vote : null;
    if (!profileId || !itemId || !vote) {
      res.status(400).json({ error: 'profileId, itemId and vote (up|down) are required' });
      return;
    }
    const feedback = await repo.addFeedback({ profileId, itemId, vote });
    res.json({ feedback });
  } catch (err) {
    next(err);
  }
});

router.get('/feedback/:profileId', async (req, res, next) => {
  try {
    const { rows } = await import('../db/pool.js').then(({ query }) =>
      query(
        `SELECT id, profile_id, item_id, vote, created_at
         FROM feedback WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [String(req.params.profileId)],
      ),
    );
    res.json({
      feedback: rows.map((row) => ({
        id: row.id,
        profileId: row.profile_id,
        itemId: row.item_id,
        vote: row.vote,
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
