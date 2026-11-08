import { Router } from 'express';
import { Role } from '@prisma/client';
import { asyncHandler } from '../../utils/http';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getOverview, getLineRows, getDefectAnalytics, getLineReport, normalizeDate } from './dashboard.service';

export const dashboardRouter = Router();

// Master / factory overview — Super Admin (all) and Work Study (own factory).
dashboardRouter.get(
  '/overview',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.WORK_STUDY),
  asyncHandler(async (req, res) => {
    res.json(await getOverview(req.user!, normalizeDate(req.query.date as string | undefined)));
  }),
);

// Line-wise output rows.
dashboardRouter.get(
  '/lines',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.WORK_STUDY),
  asyncHandler(async (req, res) => {
    const rows = await getLineRows(
      req.user!,
      normalizeDate(req.query.date as string | undefined),
      (req.query.factoryId as string) || undefined,
    );
    res.json({ rows });
  }),
);

// Detailed per-line report (hourly breakdown + defect totals) for CSV export.
dashboardRouter.get(
  '/line/:lineId/report',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.WORK_STUDY),
  asyncHandler(async (req, res) => {
    res.json(await getLineReport(req.user!, req.params.lineId, normalizeDate(req.query.date as string | undefined)));
  }),
);

// Defect analytics — Pareto by code + worst lines, across the user's scope.
dashboardRouter.get(
  '/defects',
  requireAuth,
  requireRole(Role.SUPER_ADMIN, Role.WORK_STUDY),
  asyncHandler(async (req, res) => {
    res.json(
      await getDefectAnalytics(
        req.user!,
        normalizeDate(req.query.date as string | undefined),
        (req.query.factoryId as string) || undefined,
      ),
    );
  }),
);
