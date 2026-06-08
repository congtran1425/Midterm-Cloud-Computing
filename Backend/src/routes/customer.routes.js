import express from 'express';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import { listCustomers, upsertCustomer } from '../services/customer.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const customerRouter = express.Router();

customerRouter.use(requireAuth, requireTenantUser);

customerRouter.get('/', asyncHandler(async (req, res) => {
  const customers = await listCustomers({
    tenantId: req.auth.tenantId,
    search: req.query.q,
    limit: req.query.limit
  });

  res.json({ customers });
}));

customerRouter.post('/', asyncHandler(async (req, res) => {
  const customer = await upsertCustomer({
    tenantId: req.auth.tenantId,
    input: req.body
  });

  res.status(201).json({ customer });
}));
