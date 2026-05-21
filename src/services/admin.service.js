import { getOne, query, withTransaction } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { hashPassword } from '../utils/password.js';
import { buildUpdateSet, collectDefinedFields } from '../utils/sql.js';

const tenantFieldMap = {
  tenantCode: 'tenant_code',
  tenantName: 'tenant_name',
  address: 'address',
  phone: 'phone',
  email: 'email',
  status: 'status'
};

const userFieldMap = {
  fullName: 'full_name',
  username: 'username',
  email: 'email',
  role: 'role',
  status: 'status'
};

export const getPlatformOverview = async () => {
  const [summary] = await query(
    `SELECT
        (SELECT COUNT(*) FROM tenants) AS tenant_count,
        (SELECT COUNT(*) FROM users) AS tenant_user_count,
        (SELECT COUNT(*) FROM products) AS product_count,
        (SELECT COUNT(*) FROM sales_transactions) AS transaction_count`
  );

  return summary;
};

export const listTenants = () => query(
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

export const createTenant = async (input) => {
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
  } = input;

  if (!tenantCode || !tenantName) {
    throw badRequest('Tenant code and tenant name are required');
  }

  return withTransaction(async (connection) => {
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
};

export const updateTenant = async (tenantId, input) => {
  const updates = collectDefinedFields(input, tenantFieldMap);

  if (!updates.length) {
    throw badRequest('No valid tenant fields were provided');
  }

  const { setClause, values } = buildUpdateSet(updates);

  await query(
    `UPDATE tenants
     SET ${setClause}
     WHERE tenant_id = ?`,
    [...values, tenantId]
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

  return tenant;
};

export const listPlatformUsers = ({ tenantId } = {}) => {
  const params = [];
  let tenantFilter = '';

  if (tenantId) {
    tenantFilter = 'WHERE u.tenant_id = ?';
    params.push(tenantId);
  }

  return query(
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
};

export const createPlatformUser = async (input) => {
  const {
    tenantId,
    fullName,
    username,
    email = null,
    password,
    role = 'STAFF',
    status = 'ACTIVE'
  } = input;

  if (!tenantId || !fullName || !username || !password) {
    throw badRequest('Tenant, full name, username, and password are required');
  }

  const result = await query(
    `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, fullName, username, email, await hashPassword(password), role, status]
  );

  return getOne(
    `SELECT user_id, tenant_id, full_name, username, email, role, status, created_at
     FROM users
     WHERE user_id = ?`,
    [result.insertId]
  );
};

export const updatePlatformUser = async (userId, input) => {
  const updates = collectDefinedFields(input, userFieldMap);

  if (input.password) {
    updates.push(['password_hash', await hashPassword(input.password)]);
  }

  if (!updates.length) {
    throw badRequest('No valid user fields were provided');
  }

  const { setClause, values } = buildUpdateSet(updates);

  await query(
    `UPDATE users
     SET ${setClause}
     WHERE user_id = ?`,
    [...values, userId]
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

  return user;
};
