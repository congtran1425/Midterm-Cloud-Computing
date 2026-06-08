import { getOne, query } from '../config/db.js';
import { badRequest } from '../utils/httpError.js';

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

export const listCustomers = ({ tenantId, search = null, limit = 50 }) => {
  const normalizedSearch = normalizeOptionalString(search);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const params = [tenantId];
  const filters = ['tenant_id = ?'];

  if (normalizedSearch) {
    filters.push('(full_name LIKE ? OR email LIKE ? OR phone LIKE ?)');
    params.push(`%${normalizedSearch}%`, `%${normalizedSearch}%`, `%${normalizedSearch}%`);
  }

  return query(
    `SELECT customer_id, full_name, email, phone, created_at
     FROM customers
     WHERE ${filters.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    params
  );
};

export const upsertCustomer = async ({ tenantId, input }) => {
  const fullName = normalizeOptionalString(input.fullName || input.customerName);
  const email = normalizeOptionalString(input.email || input.customerEmail);
  const phone = normalizeOptionalString(input.phone || input.customerPhone);

  if (!fullName) {
    throw badRequest('Customer fullName is required');
  }

  if (!email && !phone) {
    throw badRequest('Customer email or phone is required');
  }

  if (email) {
    await query(
      `INSERT INTO customers (tenant_id, full_name, email, phone)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         full_name = VALUES(full_name),
         phone = COALESCE(VALUES(phone), phone)`,
      [tenantId, fullName, email, phone]
    );

    return getOne(
      `SELECT customer_id, full_name, email, phone, created_at
       FROM customers
       WHERE tenant_id = ?
         AND email = ?`,
      [tenantId, email]
    );
  }

  const result = await query(
    `INSERT INTO customers (tenant_id, full_name, email, phone)
     VALUES (?, ?, NULL, ?)`,
    [tenantId, fullName, phone]
  );

  return getOne(
    `SELECT customer_id, full_name, email, phone, created_at
     FROM customers
     WHERE tenant_id = ?
       AND customer_id = ?`,
    [tenantId, result.insertId]
  );
};
