import express from 'express';
import { getOne } from '../config/db.js';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const tenantRouter = express.Router();

tenantRouter.use(requireAuth, requireTenantUser);

tenantRouter.get('/profile', asyncHandler(async (req, res) => {
  const tenant = await getOne(
    `SELECT tenant_id, tenant_code, tenant_name, address, phone, email, status, created_at, updated_at
     FROM tenants
     WHERE tenant_id = ?`,
    [req.auth.tenantId]
  );

  res.json({ tenant });
}));
