import express from 'express';
import { getOne, query } from '../config/db.js';
import { requireAuth, requireTenantUser } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { badRequest, notFound } from '../utils/httpError.js';

export const productRouter = express.Router();

productRouter.use(requireAuth, requireTenantUser);

productRouter.get('/', asyncHandler(async (req, res) => {
  const params = [req.auth.tenantId];
  const filters = ['tenant_id = ?'];

  if (req.query.status) {
    filters.push('status = ?');
    params.push(req.query.status);
  }

  if (req.query.search) {
    filters.push('(product_name LIKE ? OR sku LIKE ? OR category LIKE ?)');
    const search = `%${req.query.search}%`;
    params.push(search, search, search);
  }

  const products = await query(
    `SELECT product_id, sku, product_name, category, description, price, stock_quantity, status, created_at, updated_at
     FROM products
     WHERE ${filters.join(' AND ')}
     ORDER BY product_name`,
    params
  );

  res.json({ products });
}));

productRouter.post('/', asyncHandler(async (req, res) => {
  const {
    sku = null,
    productName,
    category = null,
    description = null,
    price,
    stockQuantity = 0,
    status = 'AVAILABLE'
  } = req.body;

  if (!productName || price === undefined) {
    throw badRequest('Product name and price are required');
  }

  const result = await query(
    `INSERT INTO products
      (tenant_id, sku, product_name, category, description, price, stock_quantity, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.auth.tenantId, sku, productName, category, description, price, stockQuantity, status]
  );

  const product = await getOne(
    `SELECT product_id, sku, product_name, category, description, price, stock_quantity, status, created_at
     FROM products
     WHERE tenant_id = ?
       AND product_id = ?`,
    [req.auth.tenantId, result.insertId]
  );

  res.status(201).json({ product });
}));

productRouter.patch('/:productId', asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const inputMap = {
    sku: 'sku',
    productName: 'product_name',
    category: 'category',
    description: 'description',
    price: 'price',
    stockQuantity: 'stock_quantity',
    status: 'status'
  };

  const updates = Object.entries(inputMap)
    .filter(([bodyKey]) => req.body[bodyKey] !== undefined)
    .map(([bodyKey, column]) => [column, req.body[bodyKey]]);

  if (!updates.length) {
    throw badRequest('No valid product fields were provided');
  }

  await query(
    `UPDATE products
     SET ${updates.map(([column]) => `${column} = ?`).join(', ')}
     WHERE tenant_id = ?
       AND product_id = ?`,
    [...updates.map(([, value]) => value), req.auth.tenantId, productId]
  );

  const product = await getOne(
    `SELECT product_id, sku, product_name, category, description, price, stock_quantity, status, created_at, updated_at
     FROM products
     WHERE tenant_id = ?
       AND product_id = ?`,
    [req.auth.tenantId, productId]
  );

  if (!product) {
    throw notFound('Product not found');
  }

  res.json({ product });
}));
