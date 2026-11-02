import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authRouter } from './modules/auth/auth.routes';
import { factoriesRouter } from './modules/factories/factories.routes';
import { workstudyRouter } from './modules/workstudy/workstudy.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { publicRouter } from './modules/public/public.routes';
import { errorHandler, notFound } from './middleware/error';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ananta-mes', time: new Date().toISOString() }));

  // No-login kiosk endpoints (QC station + TV board)
  app.use('/api/public', publicRouter);

  // Authenticated endpoints (Work Study + Super Admin)
  app.use('/api/auth', authRouter);
  app.use('/api/factories', factoriesRouter);
  app.use('/api/workstudy', workstudyRouter);
  app.use('/api/dashboard', dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
