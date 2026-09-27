import cors, { type CorsOptions } from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './env.js';
import { errorHandler } from './errors.js';
import { clerkAuth } from './lib/clerk.js';
import { adminRouter } from './routes/admin.js';
import { assessmentsRouter } from './routes/assessments.js';
import { bookingsRouter } from './routes/bookings.js';
import { contentRouter } from './routes/content.js';
import { healthRouter } from './routes/health.js';
import { learnerCoursesRouter } from './routes/learnerCourses.js';
import { meRouter } from './routes/me.js';
import { requestsRouter } from './routes/requests.js';
import { reviewsRouter } from './routes/reviews.js';
import { webhooksRouter } from './routes/webhooks.js';

const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** FRONTEND_URL origins, plus any http://localhost:* outside production. */
export function isAllowedOrigin(origin: string): boolean {
  if (env.frontendOrigins.includes(origin)) return true;
  return !env.isProduction && LOCALHOST_RE.test(origin);
}

const corsOptions: CorsOptions = {
  // No Origin header (curl, server-to-server, webhooks) needs no CORS headers.
  origin: (origin, cb) => cb(null, !origin || isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 600,
};

export function createApp(): express.Express {
  const app = express();
  // Railway terminates TLS in one proxy hop; needed for real client IPs (rate limit).
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors(corsOptions));

  app.use(healthRouter);
  // Webhooks verify signatures over the raw bytes: parse them before express.json().
  app.use('/webhooks', express.raw({ type: '*/*', limit: '1mb' }));
  app.use(webhooksRouter);

  app.use(express.json({ limit: '200kb' }));
  app.use(clerkAuth());

  app.use(contentRouter);
  app.use(meRouter);
  app.use(requestsRouter);
  app.use(bookingsRouter);
  app.use(learnerCoursesRouter);
  app.use(assessmentsRouter);
  app.use(reviewsRouter);
  app.use(adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  app.use(errorHandler);
  return app;
}
