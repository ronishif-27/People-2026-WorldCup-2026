/**
 * routes/activity.routes.ts
 *
 * GET /api/activity?limit=20  — recent prediction events for the live ticker
 */

import { Router, Request, Response } from 'express';
import { db, C } from '../db/firebase.js';
import { requireAuth } from '../middleware/auth.middleware.js';

export const activityRouter = Router();

activityRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50);

  try {
    const snap = await db.collection(C.ACTIVITY)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const events = snap.docs.map(d => {
      const ev = d.data();
      const ts = ev.createdAt instanceof Date ? ev.createdAt.toISOString() : ev.createdAt?.toDate?.()?.toISOString();
      return {
        id:         d.id,
        userId:     ev.userId,
        userName:   ev.userName,
        department: ev.department ?? '',
        site:       ev.site ?? '',
        matchLabel: ev.matchLabel,
        action:     ev.action,
        score:      ev.score ?? null,
        createdAt:  ts,
      };
    });

    res.json({ events });
  } catch (err) {
    console.error('[Activity] Error:', err);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});
