import express from 'express';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import {
  cancelOrder,
  createOrder,
  getOrderDetail,
  listOrders,
  payOrder
} from '../services/transaction.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const orderRouter = express.Router();

orderRouter.use(requireAuth, requireTenantUser);

orderRouter.get('/payment-methods', asyncHandler(async (_req, res) => {
  res.json({
    paymentMethods: [
      { value: 'CASH', label: 'Cash' },
      { value: 'BANK_TRANSFER', label: 'Bank transfer' }
    ]
  });
}));

orderRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ orders: await listOrders(req.auth.tenantId) });
}));

orderRouter.get('/:transactionId', asyncHandler(async (req, res) => {
  const order = await getOrderDetail({
    tenantId: req.auth.tenantId,
    transactionId: req.params.transactionId
  });

  res.json({ order });
}));

orderRouter.post('/', asyncHandler(async (req, res) => {
  const order = await createOrder({
    tenantId: req.auth.tenantId,
    userId: req.auth.userId,
    input: req.body
  });

  res.status(201).json({ order });
}));

orderRouter.post('/:transactionId/payment', asyncHandler(async (req, res) => {
  const result = await payOrder({
    tenantId: req.auth.tenantId,
    transactionId: req.params.transactionId,
    input: req.body
  });

  res.json(result);
}));

orderRouter.post('/:transactionId/cancel', asyncHandler(async (req, res) => {
  const order = await cancelOrder({
    tenantId: req.auth.tenantId,
    userId: req.auth.userId,
    transactionId: req.params.transactionId,
    input: req.body
  });

  res.json({ order });
}));
