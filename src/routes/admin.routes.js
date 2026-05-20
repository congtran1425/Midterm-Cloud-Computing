import express from 'express';
import { getOne, query, withTransaction } from '../config/db.js';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { hashPassword } from '../utils/password.js';

export const adminRouter = express.Router();

adminRouter.use(requireAuth, requirePlatformAdmin);

adminRouter.get('/overview', asyncHandler(async (_req, res) => {
  const [summary] = await query(
    `SELECT
        (SELECT COUNT(*) FROM tenants) AS tenant_count,
        (SELECT COUNT(*) FROM users) AS tenant_user_count,
        (SELECT COUNT(*) FROM products) AS product_count,
        (SELECT COUNT(*) FROM sales_transactions) AS transaction_count`
  );

  res.json({ summary });
}));

adminRouter.get('/tenants', asyncHandler(async (_req, res) => {
  const tenants = await query(
    `SELECT
        t.tenant_id,
        t.tenant_code,
        t.tenant_name,
        t.address,
        t.phone,
        t.email,
        t.status,
        t.created_at,
        COUNT(DISTINCT u.user_id) AS user_count,
        COUNT(DISTINCT p.product_id) AS product_count,
        COUNT(DISTINCT tx.transaction_id) AS transaction_count
      FROM tenants t
      LEFT JOIN users u
        ON u.tenant_id = t.tenant_id
      LEFT JOIN products p
        ON p.tenant_id = t.tenant_id
      LEFT JOIN sales_transactions tx
        ON tx.tenant_id = t.tenant_id
      GROUP BY t.tenant_id
      ORDER BY t.created_at DESC`
  );

  res.json({ tenants });
}));

adminRouter.post('/tenants', asyncHandler(async (req, res) => {
  const {
    tenantCode,
    tenantName,
    address = null,
    phone = null,
    email = null,
    adminFullName,
    adminUsername,
    adminEmail = null,
    adminPassword
  } = req.body;

  if (!tenantCode || !tenantName) {
    throw badRequest('Tenant code and tenant name are required');
  }

  const tenant = await withTransaction(async (connection) => {
    const [tenantResult] = await connection.execute(
      `INSERT INTO tenants (tenant_code, tenant_name, address, phone, email)
       VALUES (?, ?, ?, ?, ?)`,
      [tenantCode, tenantName, address, phone, email]
    );

    if (adminFullName && adminUsername && adminPassword) {
      await connection.execute(
        `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?, 'TENANT_ADMIN')`,
        [
          tenantResult.insertId,
          adminFullName,
          adminUsername,
          adminEmail,
          await hashPassword(adminPassword)
        ]
      );
    }

    const [rows] = await connection.execute(
      `SELECT tenant_id, tenant_code, tenant_name, address, phone, email, status, created_at
       FROM tenants
       WHERE tenant_id = ?`,
      [tenantResult.insertId]
    );

    return rows[0];
  });

  res.status(201).json({ tenant });
}));

adminRouter.patch('/tenants/:tenantId', asyncHandler(async (req, res) => {
  const { tenantId } = req.params;
  const allowed = ['tenant_code', 'tenant_name', 'address', 'phone', 'email', 'status'];
  const inputMap = {
    tenantCode: 'tenant_code',
    tenantName: 'tenant_name',
    address: 'address',
    phone: 'phone',
    email: 'email',
    status: 'status'
  };

  const updates = Object.entries(inputMap)
    .filter(([bodyKey]) => req.body[bodyKey] !== undefined)
    .map(([bodyKey, column]) => [column, req.body[bodyKey]]);

  if (!updates.length || updates.some(([column]) => !allowed.includes(column))) {
    throw badRequest('No valid tenant fields were provided');
  }

  await query(
    `UPDATE tenants
     SET ${updates.map(([column]) => `${column} = ?`).join(', ')}
     WHERE tenant_id = ?`,
    [...updates.map(([, value]) => value), tenantId]
  );

  const tenant = await getOne(
    `SELECT tenant_id, tenant_code, tenant_name, address, phone, email, status, created_at, updated_at
     FROM tenants
     WHERE tenant_id = ?`,
    [tenantId]
  );

  if (!tenant) {
    throw notFound('Tenant not found');
  }

  res.json({ tenant });
}));

adminRouter.get('/users', asyncHandler(async (req, res) => {
  const params = [];
  let tenantFilter = '';

  if (req.query.tenantId) {
    tenantFilter = 'WHERE u.tenant_id = ?';
    params.push(req.query.tenantId);
  }

  const users = await query(
    `SELECT
        u.user_id,
        u.tenant_id,
        t.tenant_code,
        t.tenant_name,
        u.full_name,
        u.username,
        u.email,
        u.role,
        u.status,
        u.created_at
      FROM users u
      JOIN tenants t
        ON t.tenant_id = u.tenant_id
      ${tenantFilter}
      ORDER BY t.tenant_name, u.full_name`,
    params
  );

  res.json({ users });
}));

adminRouter.post('/users', asyncHandler(async (req, res) => {
  const {
    tenantId,
    fullName,
    username,
    email = null,
    password,
    role = 'STAFF',
    status = 'ACTIVE'
  } = req.body;

  if (!tenantId || !fullName || !username || !password) {
    throw badRequest('Tenant, full name, username, and password are required');
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, fullName, username, email, passwordHash, role, status]
  );

  const user = await getOne(
    `SELECT user_id, tenant_id, full_name, username, email, role, status, created_at
     FROM users
     WHERE user_id = ?`,
    [result.insertId]
  );

  res.status(201).json({ user });
}));

adminRouter.patch('/users/:userId', asyncHandler(async (req, res) => {
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
     WHERE user_id = ?`,
    [...updates.map(([, value]) => value), userId]
  );

  const user = await getOne(
    `SELECT user_id, tenant_id, full_name, username, email, role, status, created_at, updated_at
     FROM users
     WHERE user_id = ?`,
    [userId]
  );

  if (!user) {
    throw notFound('User not found');
  }

  res.json({ user });
}));
