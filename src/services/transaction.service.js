import { getOne, query, withTransaction } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { sendReceiptEmail } from './mail.service.js';
import { getReceiptPayload, makeReceiptCode } from './receipt.service.js';

const normalizeItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw badRequest('At least one transaction item is required');
  }

  const quantitiesByProduct = new Map();

  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      throw badRequest('Each item must include a valid productId');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw badRequest('Each item quantity must be a positive integer');
    }

    quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
  }

  return [...quantitiesByProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
};

export const updateReceiptEmailStatus = async ({ tenantId, receiptId, status, messageId = null, error = null }) => {
  await query(
    `UPDATE receipts
     SET email_status = ?,
         email_provider_message_id = ?,
         email_error = ?,
         sent_at = CASE WHEN ? = 'SENT' THEN CURRENT_TIMESTAMP ELSE sent_at END
     WHERE tenant_id = ?
       AND receipt_id = ?`,
    [status, messageId, error ? String(error).slice(0, 1000) : null, status, tenantId, receiptId]
  );
};

const attemptReceiptEmail = async ({ tenantId, receiptId }) => {
  const receiptForEmail = await getReceiptPayload({ tenantId, receiptId });

  try {
    const info = await sendReceiptEmail(receiptForEmail);
    await updateReceiptEmailStatus({
      tenantId,
      receiptId,
      status: 'SENT',
      messageId: info.messageId || null
    });
  } catch (error) {
    await updateReceiptEmailStatus({
      tenantId,
      receiptId,
      status: 'FAILED',
      error: error.message
    });
    throw error;
  }
};

export const getTransactionOverview = async (tenantId) => {
  const [summary] = await query(
    `SELECT
        COUNT(*) AS transaction_count,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(AVG(total_amount), 0) AS average_sale
      FROM sales_transactions
      WHERE tenant_id = ?`,
    [tenantId]
  );

  const [today] = await query(
    `SELECT
        COUNT(*) AS today_transaction_count,
        COALESCE(SUM(total_amount), 0) AS today_revenue
      FROM sales_transactions
      WHERE tenant_id = ?
        AND DATE(transaction_date) = CURRENT_DATE`,
    [tenantId]
  );

  return { ...summary, ...today };
};

export const listTransactions = (tenantId) => query(
  `SELECT
      tx.transaction_id,
      tx.customer_name,
      tx.customer_email,
      tx.subtotal,
      tx.total_amount,
      tx.payment_status,
      tx.transaction_date,
      u.full_name AS cashier_name,
      r.receipt_id,
      r.receipt_code,
      r.email_status,
      COUNT(td.detail_id) AS item_count
    FROM sales_transactions tx
    JOIN users u
      ON u.tenant_id = tx.tenant_id
     AND u.user_id = tx.user_id
    LEFT JOIN receipts r
      ON r.tenant_id = tx.tenant_id
     AND r.transaction_id = tx.transaction_id
    LEFT JOIN transaction_details td
      ON td.tenant_id = tx.tenant_id
     AND td.transaction_id = tx.transaction_id
    WHERE tx.tenant_id = ?
    GROUP BY tx.transaction_id, r.receipt_id
    ORDER BY tx.transaction_date DESC
    LIMIT 100`,
  [tenantId]
);

export const getTransactionReceipt = ({ tenantId, transactionId }) => getReceiptPayload({
  tenantId,
  transactionId
});

export const createTransaction = async ({ tenantId, userId, input }) => {
  const items = normalizeItems(input.items);
  const customerName = input.customerName || null;
  const customerEmail = input.customerEmail || null;
  const sendEmail = Boolean(input.sendEmail && customerEmail);

  const created = await withTransaction(async (connection) => {
    const preparedItems = [];

    for (const item of items) {
      const [products] = await connection.execute(
        `SELECT product_id, product_name, price, stock_quantity, status
         FROM products
         WHERE tenant_id = ?
           AND product_id = ?
           AND status = 'AVAILABLE'
         FOR UPDATE`,
        [tenantId, item.productId]
      );

      const product = products[0];

      if (!product) {
        throw notFound(`Product ${item.productId} was not found or is unavailable`);
      }

      if (product.stock_quantity < item.quantity) {
        throw badRequest(`Not enough stock for ${product.product_name}`);
      }

      const unitPrice = Number(product.price);
      const lineTotal = unitPrice * item.quantity;
      preparedItems.push({
        ...item,
        productName: product.product_name,
        unitPrice,
        lineTotal
      });
    }

    const subtotal = preparedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalAmount = subtotal;

    const [transactionResult] = await connection.execute(
      `INSERT INTO sales_transactions
        (tenant_id, user_id, customer_name, customer_email, subtotal, total_amount, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, 'PAID')`,
      [tenantId, userId, customerName, customerEmail, subtotal, totalAmount]
    );

    const transactionId = transactionResult.insertId;

    for (const item of preparedItems) {
      await connection.execute(
        `INSERT INTO transaction_details
          (tenant_id, transaction_id, product_id, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [tenantId, transactionId, item.productId, item.quantity, item.unitPrice, item.lineTotal]
      );

      await connection.execute(
        `UPDATE products
         SET stock_quantity = stock_quantity - ?
         WHERE tenant_id = ?
           AND product_id = ?`,
        [item.quantity, tenantId, item.productId]
      );
    }

    const receiptCode = makeReceiptCode(tenantId, transactionId);
    const [receiptResult] = await connection.execute(
      `INSERT INTO receipts (tenant_id, transaction_id, receipt_code, recipient_email)
       VALUES (?, ?, ?, ?)`,
      [tenantId, transactionId, receiptCode, customerEmail]
    );

    return {
      transactionId,
      receiptId: receiptResult.insertId
    };
  });

  if (sendEmail) {
    try {
      await attemptReceiptEmail({ tenantId, receiptId: created.receiptId });
    } catch (_error) {
      // The transaction is already committed; the receipt records the email failure.
    }
  }

  return getReceiptPayload({
    tenantId,
    receiptId: created.receiptId
  });
};

export const sendTransactionReceiptEmail = async ({ tenantId, transactionId, recipientEmail }) => {
  const transaction = await getOne(
    `SELECT tx.transaction_id, r.receipt_id
     FROM sales_transactions tx
     JOIN receipts r
       ON r.tenant_id = tx.tenant_id
      AND r.transaction_id = tx.transaction_id
     WHERE tx.tenant_id = ?
       AND tx.transaction_id = ?`,
    [tenantId, transactionId]
  );

  if (!transaction) {
    throw notFound('Transaction not found');
  }

  if (recipientEmail) {
    await query(
      `UPDATE receipts
       SET recipient_email = ?
       WHERE tenant_id = ?
         AND receipt_id = ?`,
      [recipientEmail, tenantId, transaction.receipt_id]
    );
  }

  const receipt = await getReceiptPayload({
    tenantId,
    receiptId: transaction.receipt_id
  });

  if (!receipt.recipient_email && !receipt.customer_email) {
    throw badRequest('A recipient email is required');
  }

  try {
    await attemptReceiptEmail({ tenantId, receiptId: transaction.receipt_id });
  } catch (error) {
    throw badRequest(error.message);
  }

  return getReceiptPayload({
    tenantId,
    receiptId: transaction.receipt_id
  });
};
