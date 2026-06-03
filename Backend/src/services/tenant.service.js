import { getOne } from '../config/db.js';

export const getTenantProfile = (tenantId) => getOne(
  `SELECT tenant_id, tenant_code, tenant_name, address, phone, email, status, created_at, updated_at
   FROM tenants
   WHERE tenant_id = ?`,
  [tenantId]
);
