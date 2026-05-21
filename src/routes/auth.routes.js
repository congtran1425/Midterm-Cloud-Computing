import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loginPlatformAdmin, loginTenantUser } from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authRouter = express.Router();

authRouter.post('/platform/login', asyncHandler(async (req, res) => {
  res.json(await loginPlatformAdmin(req.body));
}));

authRouter.post('/tenant/login', asyncHandler(async (req, res) => {
  res.json(await loginTenantUser(req.body));
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ user: req.auth });
}));
