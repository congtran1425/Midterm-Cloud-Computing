import { getOne, query, withTransaction } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';

const normalizeQuantityChange = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed === 0) {
    throw badRequest('Quantity change must be a non-zero integer');
  }

  return parsed;
};

export const listInventoryProducts = (tenantId) => query(
  `SELECT
      p.product_id,
      p.sku,
      p.product_name,
      p.category,
      p.price,
      p.stock_quantity,
      p.status,
      (
        SELECT MAX(im.created_at)
        FROM inventory_movements im
        WHERE im.tenant_id = p.tenant_id
          AND im.product_id = p.product_id
      ) AS last_movement_at
    FROM products p
    WHERE p.tenant_id = ?
    ORDER BY p.product_name`,
  [tenantId]
);

export const listInventoryMovements = ({ tenantId, productId = null, limit = 100 }) => {
  const params = [tenantId];
  const filters = ['im.tenant_id = ?'];

  if (productId) {
    filters.push('im.product_id = ?');
    params.push(productId);
  }

  return query(
    `SELECT
        im.movement_id,
        im.product_id,
        p.product_name,
        p.sku,
        im.user_id,
        u.full_name AS actor_name,
        im.movement_type,
        im.quantity_change,
        im.quantity_before,
        im.quantity_after,
        im.reference_type,
        im.reference_id,
        im.note,
        im.created_at
      FROM inventory_movements im
      JOIN products p
        ON p.tenant_id = im.tenant_id
       AND p.product_id = im.product_id
      JOIN users u
        ON u.tenant_id = im.tenant_id
       AND u.user_id = im.user_id
      WHERE ${filters.join(' AND ')}
      ORDER BY im.created_at DESC
      LIMIT ${Number(limit) || 100}`,
    params
  );
};

export const insertInventoryMovement = async (connection, {
  tenantId,
  productId,
  userId,
  movementType,
  quantityChange,
  quantityBefore,
  quantityAfter,
  referenceType = 'MANUAL',
  referenceId = null,
  note = null
}) => {
  await connection.execute(
    `INSERT INTO inventory_movements
      (tenant_id, product_id, user_id, movement_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      productId,
      userId,
      movementType,
      quantityChange,
      quantityBefore,
      quantityAfter,
      referenceType,
      referenceId,
      note
    ]
  );
};

export const applyInventoryChange = async (connection, {
  tenantId,
  productId,
  userId,
  quantityChange,
  movementType,
  referenceType = 'MANUAL',
  referenceId = null,
  note = null
}) => {
  const [products] = await connection.execute(
    `SELECT product_id, product_name, stock_quantity
     FROM products
     WHERE tenant_id = ?
       AND product_id = ?
     FOR UPDATE`,
    [tenantId, productId]
  );

  const product = products[0];

  if (!product) {
    throw notFound(`Product ${productId} was not found`);
  }

  const quantityBefore = Number(product.stock_quantity);
  const quantityAfter = quantityBefore + quantityChange;

  if (quantityAfter < 0) {
    throw badRequest(`Stock for ${product.product_name} cannot go below zero`);
  }

  await connection.execute(
    `UPDATE products
     SET stock_quantity = ?
     WHERE tenant_id = ?
       AND product_id = ?`,
    [quantityAfter, tenantId, productId]
  );

  await insertInventoryMovement(connection, {
    tenantId,
    productId,
    userId,
    movementType,
    quantityChange,
    quantityBefore,
    quantityAfter,
    referenceType,
    referenceId,
    note
  });

  return { quantityBefore, quantityAfter };
};

export const adjustInventory = async ({ tenantId, userId, input }) => {
  const productId = Number(input.productId);
  const quantityChange = normalizeQuantityChange(input.quantityChange);
  const movementType = input.movementType || (quantityChange > 0 ? 'RESTOCK' : 'ADJUSTMENT');

  if (!Number.isInteger(productId) || productId <= 0) {
    throw badRequest('A valid productId is required');
  }

  await withTransaction(async (connection) => {
    await applyInventoryChange(connection, {
      tenantId,
      productId,
      userId,
      quantityChange,
      movementType,
      referenceType: 'MANUAL',
      note: input.note || null
    });
  });

  return getOne(
    `SELECT product_id, sku, product_name, category, price, stock_quantity, status, updated_at
     FROM products
     WHERE tenant_id = ?
       AND product_id = ?`,
    [tenantId, productId]
  );
};
