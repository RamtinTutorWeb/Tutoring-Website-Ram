import { Router } from 'express';
import * as db from '../db.js';
import { ownerFilter, requireAuth, viewerOf } from '../middleware/auth.js';

export const bookingsRouter = Router();

bookingsRouter.get('/bookings', requireAuth, async (req, res) => {
  res.json(await db.listBookings(ownerFilter(viewerOf(req))));
});
