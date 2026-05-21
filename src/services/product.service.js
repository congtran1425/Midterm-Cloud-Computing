import { getOne, query } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { buildUpdateSet, collectDefinedFields } from '../utils/sql.js';

const productFieldMap = {
  sku: 'sku',
  productName: 'product_name',
  category: 'category',
  description: 'description',
  price: 'price',
  stockQuantity: 'stock_quantity',
  status: 'status'
};

export const listProducts = async ({ tenantId, status, search }) => {
  const params = [tenantId];
  const filters = ['tenant_id = ?'];

  if (status) {
    filters.push('status = ?');
    params.push(status);
  }

  if (search) {
    filters.push('(product_name LIKE ? OR sku LIKE ? OR category LIKE ?)');
    const value = `%${search}%`;
    params.push(value, value, value);
  }

  return query(
    `SELECT product_id, sku, product_name, category, description, price, stock_quantity, status, created_at, updated_at
     FROM products
     WHERE ${filters.join(' AND ')}
     ORDER BY product_name`,
    params
  );
};

export const getProductById = (tenantId, productId) => getOne(
  `SELECT product_id, sku, product_name, category, description, price, stock_quantity, status, created_at, updated_at
   FROM products
   WHERE tenant_id = ?
     AND product_id = ?`,
  [tenantId, productId]
);

export const createProduct = async (tenantId, input) => {
  const {
    sku = null,
    productName,
    category = null,
    description = null,
    price,
    stockQuantity = 0,
    status = 'AVAILABLE'
  } = input;

  if (!productName || price === undefined) {
    throw badRequest('Product name and price are required');
  }

  const result = await query(
    `INSERT INTO products
      (tenant_id, sku, product_name, category, description, price, stock_quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [tenantId, sku, productName, category, description, price, stockQuantity, status]
  );

  return getProductById(tenantId, result.insertId);
};

export const updateProduct = async (tenantId, productId, input) => {
  const updates = collectDefinedFields(input, productFieldMap);

  if (!updates.length) {
    throw badRequest('No valid product fields were provided');
  }

  const { setClause, values } = buildUpdateSet(updates);

  await query(
    `UPDATE products
     SET ${setClause}
     WHERE tenant_id = ?
       AND product_id = ?`,
    [...values, tenantId, productId]
  );

  const product = await getProductById(tenantId, productId);

  if (!product) {
    throw notFound('Product not found');
  }

  return product;
};
