import { getOne, query } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { hashPassword } from '../utils/password.js';
import { buildUpdateSet, collectDefinedFields } from '../utils/sql.js';

const userFieldMap = {
  fullName: 'full_name',
  username: 'username',
  email: 'email',
  role: 'role',
  status: 'status'
};

export const listTenantTeam = (tenantId) => query(
  `SELECT user_id, full_name, username, email, role, status, created_at, updated_at
   FROM users
   WHERE tenant_id = ?
   ORDER BY role, full_name`,
  [tenantId]
);

export const createTenantTeamMember = async (tenantId, input) => {
  const {
    fullName,
    username,
    email = null,
    password,
    role = 'STAFF',
    status = 'ACTIVE'
  } = input;

  if (!fullName || !username || !password) {
    throw badRequest('Full name, username, and password are required');
  }

  const result = await query(
    `INSERT INTO users (tenant_id, full_name, username, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, fullName, username, email, await hashPassword(password), role, status]
  );

  return getOne(
    `SELECT user_id, full_name, username, email, role, status, created_at
     FROM users
     WHERE tenant_id = ?
       AND user_id = ?`,
    [tenantId, result.insertId]
  );
};

export const updateTenantTeamMember = async (tenantId, userId, input) => {
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
     WHERE tenant_id = ?
       AND user_id = ?`,
    [...values, tenantId, userId]
  );

  const user = await getOne(
    `SELECT user_id, full_name, username, email, role, status, created_at, updated_at
     FROM users
     WHERE tenant_id = ?
       AND user_id = ?`,
    [tenantId, userId]
  );

  if (!user) {
    throw notFound('User not found');
  }

  return user;
};
