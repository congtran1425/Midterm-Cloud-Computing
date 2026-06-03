import express from 'express';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import { createProduct, listProducts, updateProduct } from '../services/product.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const productRouter = express.Router();

productRouter.use(requireAuth, requireTenantUser);

productRouter.get('/', asyncHandler(async (req, res) => {
  const products = await listProducts({
    tenantId: req.auth.tenantId,
    status: req.query.status,
    search: req.query.search
  });

  res.json({ products });
}));

productRouter.post('/', asyncHandler(async (req, res) => {
  const product = await createProduct(req.auth.tenantId, req.body);
  res.status(201).json({ product });
}));

productRouter.patch('/:productId', asyncHandler(async (req, res) => {
  const product = await updateProduct(req.auth.tenantId, req.params.productId, req.body);
  res.json({ product });
}));
