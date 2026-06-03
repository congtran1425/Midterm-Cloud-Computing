import express from 'express';
import { requireAuth, requireTenantAdmin, requireTenantUser } from '../middleware/auth.js';
import {
  adjustInventory,
  listInventoryMovements,
  listInventoryProducts
} from '../services/inventory.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const inventoryRouter = express.Router();

inventoryRouter.use(requireAuth, requireTenantUser);

inventoryRouter.get('/products', asyncHandler(async (req, res) => {
  res.json({ products: await listInventoryProducts(req.auth.tenantId) });
}));

inventoryRouter.get('/movements', asyncHandler(async (req, res) => {
  const movements = await listInventoryMovements({
    tenantId: req.auth.tenantId,
    productId: req.query.productId || null,
    limit: req.query.limit || 100
  });

  res.json({ movements });
}));

inventoryRouter.post('/adjustments', requireTenantAdmin, asyncHandler(async (req, res) => {
  const product = await adjustInventory({
    tenantId: req.auth.tenantId,
    userId: req.auth.userId,
    input: req.body
  });

  res.status(201).json({ product });
}));
