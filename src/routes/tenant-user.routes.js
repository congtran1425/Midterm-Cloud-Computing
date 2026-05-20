import express from 'express';
import { getOne, query } from '../config/db.js';
import { requireAuth, requireTenantAdmin, requireTenantUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { hashPassword } from '../utils/password.js';

export const tenantUserRouter = express.Router();

tenantUserRouter.use(requireAuth, requireTenantUser);

tenantUserRouter.get('/', requireTenantAdmin, asyncHandler(async (req, res) => {
  const users = await query(
    `SELECT user_id, full_name, username, email, role, status, created_at, updated_at
     FROM users
     WHERE tenant_id = ?
     ORDER BY role, full_name`,
    [req.auth.tenantId]
  );

  res.json({ users });
}));

tenantUserRouter.post('/', requireTenantAdmin, asyncHandler(async (req, res) => {
  const {
    fullName,
    username,
    email = null,
    password,
    role = 'STAFF',
    status = 'ACTIVE'
  } = req.body;

  if (!fullName || !username || !password) {
    throw badRequest('Full name, username, and password are required');
  }

  const result = await query(
    `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.auth.tenantId, fullName, username, email, await hashPassword(password), role, status]
  );

  const user = await getOne(
    `SELECT user_id, full_name, username, email, role, status, created_at
     FROM users
     WHERE tenant_id = ?
       AND user_id = ?`,
    [req.auth.tenantId, result.insertId]
  );

  res.status(201).json({ user });
}));

tenantUserRouter.patch('/:userId', requireTenantAdmin, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const inputMap = {
    fullName: 'full_name',
    username: 'username',
    email: 'email',
    role: 'role',
    status: 'status'
  };

  const updates = Object.entries(inputMap)
    .filter(([bodyKey]) => req.body[bodyKey] !== undefined)
    .map(([bodyKey, column]) => [column, req.body[bodyKey]]);

  if (req.body.password) {
    updates.push(['password_hash', await hashPassword(req.body.password)]);
  }

  if (!updates.length) {
    throw badRequest('No valid user fields were provided');
  }

  await query(
    `UPDATE users
     SET ${updates.map(([column]) => `${column} = ?`).join(', ')}
     WHERE tenant_id = ?
       AND user_id = ?`,
    [...updates.map(([, value]) => value), req.auth.tenantId, userId]
  );

  const user = await getOne(
    `SELECT user_id, full_name, username, email, role, status, created_at, updated_at
     FROM users
     WHERE tenant_id = ?
       AND user_id = ?`,
    [req.auth.tenantId, userId]
  );

  if (!user) {
    throw notFound('User not found');
  }

  res.json({ user });
}));
