import express from 'express';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js';
import {
  createPlatformUser,
  createTenant,
  getPlatformOverview,
  listPlatformUsers,
  listTenants,
  updatePlatformUser,
  updateTenant
} from '../services/admin.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const adminRouter = express.Router();

adminRouter.use(requireAuth, requirePlatformAdmin);

adminRouter.get('/overview', asyncHandler(async (_req, res) => {
  res.json({ summary: await getPlatformOverview() });
}));

adminRouter.get('/tenants', asyncHandler(async (_req, res) => {
  res.json({ tenants: await listTenants() });
}));

adminRouter.post('/tenants', asyncHandler(async (req, res) => {
  const tenant = await createTenant(req.body);
  res.status(201).json({ tenant });
}));

adminRouter.patch('/tenants/:tenantId', asyncHandler(async (req, res) => {
  const tenant = await updateTenant(req.params.tenantId, req.body);
  res.json({ tenant });
}));

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const users = await listPlatformUsers({ tenantId: req.query.tenantId });
  res.json({ users });
}));

adminRouter.post('/users', asyncHandler(async (req, res) => {
  const user = await createPlatformUser(req.body);
  res.status(201).json({ user });
}));

adminRouter.patch('/users/:userId', asyncHandler(async (req, res) => {
  const user = await updatePlatformUser(req.params.userId, req.body);
  res.json({ user });
}));
