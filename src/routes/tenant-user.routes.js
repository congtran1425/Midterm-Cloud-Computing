import express from 'express';
import { requireAuth, requireTenantAdmin, requireTenantUser } from '../middleware/auth.js';
import {
  createTenantTeamMember,
  listTenantTeam,
  updateTenantTeamMember
} from '../services/team.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const tenantUserRouter = express.Router();

tenantUserRouter.use(requireAuth, requireTenantUser);

tenantUserRouter.get('/', requireTenantAdmin, asyncHandler(async (req, res) => {
  res.json({ users: await listTenantTeam(req.auth.tenantId) });
}));

tenantUserRouter.post('/', requireTenantAdmin, asyncHandler(async (req, res) => {
  const user = await createTenantTeamMember(req.auth.tenantId, req.body);
  res.status(201).json({ user });
}));

tenantUserRouter.patch('/:userId', requireTenantAdmin, asyncHandler(async (req, res) => {
  const user = await updateTenantTeamMember(req.auth.tenantId, req.params.userId, req.body);
  res.json({ user });
}));
