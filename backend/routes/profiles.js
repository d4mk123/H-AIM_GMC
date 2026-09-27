import { Router } from 'express';
import * as repo from '../db/repo.js';

const router = Router();

function readProfile(body) {
  const source = body && typeof body.profile === 'object' && body.profile !== null ? body.profile : body;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    const error = new Error('profile body must be an object');
    error.status = 400;
    throw error;
  }
  if (typeof source.id !== 'string' || !source.id.trim()) {
    const error = new Error('profile.id is required');
    error.status = 400;
    throw error;
  }
  return {
    id: source.id.trim().slice(0, 64),
    name: typeof source.name === 'string' ? source.name.trim().slice(0, 120) || null : null,
    occupation: typeof source.occupation === 'string' ? source.occupation.trim().slice(0, 120) || null : null,
    interests: Array.isArray(source.interests)
      ? source.interests.filter((tag) => typeof tag === 'string' && tag.trim()).slice(0, 30).map((tag) => tag.trim())
      : [],
  };
}

router.post('/profiles', async (req, res, next) => {
  try {
    const profile = readProfile(req.body);
    const saved = await repo.upsertProfile(profile);
    res.json({ profile: saved });
  } catch (err) {
    next(err);
  }
});

router.get('/profiles/:id', async (req, res, next) => {
  try {
    const profile = await repo.getProfile(String(req.params.id));
    if (!profile) {
      res.status(404).json({ error: 'profile not found' });
      return;
    }
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

export default router;
