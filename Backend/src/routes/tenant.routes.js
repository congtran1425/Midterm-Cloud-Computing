import express from 'express';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import { getTenantProfile } from '../services/tenant.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const tenantRouter = express.Router();

tenantRouter.use(requireAuth, requireTenantUser);

tenantRouter.get('/profile', asyncHandler(async (req, res) => {
  res.json({ tenant: await getTenantProfile(req.auth.tenantId) });
}));
