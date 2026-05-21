import { getOne } from '../config/db.js';
import { signToken } from '../middleware/auth.js';
import { badRequest, unauthorized } from '../utils/httpError.js';
import { verifyPassword } from '../utils/password.js';

export const loginPlatformAdmin = async ({ username, password }) => {
  if (!username || !password) {
    throw badRequest('Username and password are required');
  }

  const admin = await getOne(
    `SELECT platform_admin_id, full_name, username, email, password_hash
      FROM platform_admins
      WHERE username = ?
        AND status = 'ACTIVE'`,
    [username]
  );

  if (!admin || !(await verifyPassword(password, admin.password_hash))) {
    throw unauthorized('Invalid platform admin credentials');
  }

  const user = {
    scope: 'platform',
    platformAdminId: admin.platform_admin_id,
    fullName: admin.full_name,
    username: admin.username,
    email: admin.email
  };

  return {
    token: signToken(user),
    user
  };
};

export const loginTenantUser = async ({ tenantCode, username, password }) => {
  if (!tenantCode || !username || !password) {
    throw badRequest('Tenant code, username, and password are required');
  }

  const userRow = await getOne(
    `SELECT
        u.user_id,
        u.tenant_id,
        u.full_name,
        u.username,
        u.email,
        u.role,
        u.password_hash,
        t.tenant_code,
        t.tenant_name
      FROM users u
      JOIN tenants t
        ON t.tenant_id = u.tenant_id
      WHERE t.tenant_code = ?
        AND u.username = ?
        AND t.status = 'ACTIVE'
        AND u.status = 'ACTIVE'`,
    [tenantCode, username]
  );

  if (!userRow || !(await verifyPassword(password, userRow.password_hash))) {
    throw unauthorized('Invalid tenant credentials');
  }

  const user = {
    scope: 'tenant',
    tenantId: userRow.tenant_id,
    tenantCode: userRow.tenant_code,
    tenantName: userRow.tenant_name,
    userId: userRow.user_id,
    fullName: userRow.full_name,
    username: userRow.username,
    email: userRow.email,
    role: userRow.role
  };

  return {
    token: signToken(user),
    user
  };
};
