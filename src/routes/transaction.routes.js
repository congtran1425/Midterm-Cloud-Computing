import express from 'express';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import {
  createTransaction,
  getTransactionOverview,
  getTransactionReceipt,
  listTransactions,
  sendTransactionReceiptEmail
} from '../services/transaction.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const transactionRouter = express.Router();

transactionRouter.use(requireAuth, requireTenantUser);

transactionRouter.get('/overview', asyncHandler(async (req, res) => {
  res.json({ summary: await getTransactionOverview(req.auth.tenantId) });
}));

transactionRouter.get('/', asyncHandler(async (req, res) => {
  res.json({ transactions: await listTransactions(req.auth.tenantId) });
}));

transactionRouter.get('/:transactionId', asyncHandler(async (req, res) => {
  const receipt = await getTransactionReceipt({
    tenantId: req.auth.tenantId,
    transactionId: req.params.transactionId
  });

  res.json({ receipt });
}));

transactionRouter.post('/', asyncHandler(async (req, res) => {
  const receipt = await createTransaction({
    tenantId: req.auth.tenantId,
    userId: req.auth.userId,
    input: req.body
  });

  res.status(201).json({ receipt });
}));

transactionRouter.post('/:transactionId/send-email', asyncHandler(async (req, res) => {
  const receipt = await sendTransactionReceiptEmail({
    tenantId: req.auth.tenantId,
    transactionId: req.params.transactionId,
    recipientEmail: req.body.recipientEmail
  });

  res.json({ receipt });
}));
