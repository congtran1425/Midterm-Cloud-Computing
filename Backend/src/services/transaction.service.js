import { getOne, query, withTransaction } from '../config/db.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { applyInventoryChange } from './inventory.service.js';
import { sendReceiptEmail } from './mail.service.js';
import { getReceiptPayload, makeReceiptCode } from './receipt.service.js';

const PAYMENT_METHODS = new Set(['CASH', 'BANK_TRANSFER']);

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

const normalizePaymentMethod = (paymentMethod) => {
  const value = String(paymentMethod || '').toUpperCase();

  if (!PAYMENT_METHODS.has(value)) {
    throw badRequest('Payment method must be CASH or BANK_TRANSFER');
  }

  return value;
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

const prepareOrderItems = async (connection, tenantId, items) => {
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

  return preparedItems;
};

export const getOrderDetail = async ({ tenantId, transactionId }) => {
  const order = await getOne(
    `SELECT
        tx.transaction_id,
        tx.tenant_id,
        tx.user_id,
        tx.customer_name,
        tx.customer_email,
        tx.subtotal,
        tx.total_amount,
        tx.order_status,
        tx.payment_status,
        tx.payment_method,
        tx.payment_reference,
        tx.payment_note,
        tx.paid_at,
        tx.transaction_date,
        tx.created_at,
        u.full_name AS cashier_name,
        r.receipt_id,
        r.receipt_code,
        r.email_status
      FROM sales_transactions tx
      JOIN users u
        ON u.tenant_id = tx.tenant_id
       AND u.user_id = tx.user_id
      LEFT JOIN receipts r
        ON r.tenant_id = tx.tenant_id
       AND r.transaction_id = tx.transaction_id
      WHERE tx.tenant_id = ?
        AND tx.transaction_id = ?`,
    [tenantId, transactionId]
  );

  if (!order) {
    throw notFound('Order not found');
  }

  const items = await query(
    `SELECT
        td.detail_id,
        td.product_id,
        p.product_name,
        p.sku,
        td.quantity,
        td.unit_price,
        td.line_total
      FROM transaction_details td
      JOIN products p
        ON p.tenant_id = td.tenant_id
       AND p.product_id = td.product_id
      WHERE td.tenant_id = ?
        AND td.transaction_id = ?
      ORDER BY td.detail_id`,
    [tenantId, transactionId]
  );

  return { ...order, items };
};

export const getTransactionOverview = async (tenantId) => {
  const [summary] = await query(
    `SELECT
        COUNT(*) AS transaction_count,
        SUM(CASE WHEN payment_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_payment_count,
        SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END) AS paid_transaction_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END), 0) AS revenue,
        COALESCE(AVG(CASE WHEN payment_status = 'PAID' THEN total_amount END), 0) AS average_sale
      FROM sales_transactions
      WHERE tenant_id = ?`,
    [tenantId]
  );

  const [today] = await query(
    `SELECT
        COUNT(*) AS today_transaction_count,
        COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END), 0) AS today_revenue
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
      tx.order_status,
      tx.payment_status,
      tx.payment_method,
      tx.paid_at,
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
    GROUP BY
      tx.transaction_id,
      tx.customer_name,
      tx.customer_email,
      tx.subtotal,
      tx.total_amount,
      tx.order_status,
      tx.payment_status,
      tx.payment_method,
      tx.paid_at,
      tx.transaction_date,
      u.full_name,
      r.receipt_id,
      r.receipt_code,
      r.email_status
    ORDER BY tx.transaction_date DESC
    LIMIT 100`,
  [tenantId]
);

export const listOrders = listTransactions;

export const getTransactionReceipt = ({ tenantId, transactionId }) => getReceiptPayload({
  tenantId,
  transactionId
});

export const createOrder = async ({ tenantId, userId, input }) => {
  const items = normalizeItems(input.items);
  const customerName = input.customerName || null;
  const customerEmail = input.customerEmail || null;

  const created = await withTransaction(async (connection) => {
    const preparedItems = await prepareOrderItems(connection, tenantId, items);
    const subtotal = preparedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const totalAmount = subtotal;

    const [transactionResult] = await connection.execute(
      `INSERT INTO sales_transactions
        (tenant_id, user_id, customer_name, customer_email, subtotal, total_amount, order_status, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, 'AWAITING_PAYMENT', 'PENDING')`,
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

      await applyInventoryChange(connection, {
        tenantId,
        productId: item.productId,
        userId,
        quantityChange: -item.quantity,
        movementType: 'ORDER_CREATED',
        referenceType: 'TRANSACTION',
        referenceId: transactionId,
        note: `Reserved stock for order #${transactionId}`
      });
    }

    return { transactionId };
  });

  return getOrderDetail({ tenantId, transactionId: created.transactionId });
};

export const payOrder = async ({ tenantId, transactionId, input }) => {
  const paymentMethod = normalizePaymentMethod(input.paymentMethod);
  const sendEmail = Boolean(input.sendEmail);
  const created = await withTransaction(async (connection) => {
    const [transactions] = await connection.execute(
      `SELECT transaction_id, customer_email, order_status, payment_status
       FROM sales_transactions
       WHERE tenant_id = ?
         AND transaction_id = ?
       FOR UPDATE`,
      [tenantId, transactionId]
    );

    const transaction = transactions[0];

    if (!transaction) {
      throw notFound('Order not found');
    }

    if (transaction.order_status === 'CANCELLED' || transaction.payment_status === 'CANCELLED') {
      throw badRequest('Cancelled orders cannot be paid');
    }

    if (transaction.payment_status === 'PAID') {
      throw badRequest('Order is already paid');
    }

    await connection.execute(
      `UPDATE sales_transactions
       SET order_status = 'COMPLETED',
           payment_status = 'PAID',
           payment_method = ?,
           payment_reference = ?,
           payment_note = ?,
           paid_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ?
         AND transaction_id = ?`,
      [
        paymentMethod,
        input.paymentReference || null,
        input.paymentNote || null,
        tenantId,
        transactionId
      ]
    );

    const [receipts] = await connection.execute(
      `SELECT receipt_id
       FROM receipts
       WHERE tenant_id = ?
         AND transaction_id = ?
       FOR UPDATE`,
      [tenantId, transactionId]
    );

    if (receipts[0]) {
      if (input.recipientEmail) {
        await connection.execute(
          `UPDATE receipts
           SET recipient_email = ?
           WHERE tenant_id = ?
             AND receipt_id = ?`,
          [input.recipientEmail, tenantId, receipts[0].receipt_id]
        );
      }

      return { receiptId: receipts[0].receipt_id };
    }

    const receiptCode = makeReceiptCode(tenantId, transactionId);
    const [receiptResult] = await connection.execute(
      `INSERT INTO receipts (tenant_id, transaction_id, receipt_code, recipient_email)
       VALUES (?, ?, ?, ?)`,
      [tenantId, transactionId, receiptCode, input.recipientEmail || transaction.customer_email || null]
    );

    return { receiptId: receiptResult.insertId };
  });

  if (sendEmail) {
    try {
      await attemptReceiptEmail({ tenantId, receiptId: created.receiptId });
    } catch (_error) {
      // Payment is already committed; the receipt records the email failure.
    }
  }

  return {
    order: await getOrderDetail({ tenantId, transactionId }),
    receipt: await getReceiptPayload({ tenantId, receiptId: created.receiptId })
  };
};

export const cancelOrder = async ({ tenantId, userId, transactionId, input = {} }) => {
  await withTransaction(async (connection) => {
    const [transactions] = await connection.execute(
      `SELECT transaction_id, order_status, payment_status
       FROM sales_transactions
       WHERE tenant_id = ?
         AND transaction_id = ?
       FOR UPDATE`,
      [tenantId, transactionId]
    );

    const transaction = transactions[0];

    if (!transaction) {
      throw notFound('Order not found');
    }

    if (transaction.payment_status === 'PAID') {
      throw badRequest('Paid orders cannot be cancelled from this endpoint');
    }

    if (transaction.order_status === 'CANCELLED') {
      throw badRequest('Order is already cancelled');
    }

    const [items] = await connection.execute(
      `SELECT product_id, quantity
       FROM transaction_details
       WHERE tenant_id = ?
         AND transaction_id = ?`,
      [tenantId, transactionId]
    );

    for (const item of items) {
      await applyInventoryChange(connection, {
        tenantId,
        productId: item.product_id,
        userId,
        quantityChange: item.quantity,
        movementType: 'ORDER_CANCELLED',
        referenceType: 'TRANSACTION',
        referenceId: transactionId,
        note: input.reason || `Cancelled order #${transactionId}`
      });
    }

    await connection.execute(
      `UPDATE sales_transactions
       SET order_status = 'CANCELLED',
           payment_status = 'CANCELLED',
           payment_note = ?
       WHERE tenant_id = ?
         AND transaction_id = ?`,
      [input.reason || null, tenantId, transactionId]
    );
  });

  return getOrderDetail({ tenantId, transactionId });
};

export const createTransaction = async ({ tenantId, userId, input }) => {
  const order = await createOrder({ tenantId, userId, input });
  const payment = await payOrder({
    tenantId,
    transactionId: order.transaction_id,
    input: {
      paymentMethod: input.paymentMethod || 'CASH',
      paymentReference: input.paymentReference,
      paymentNote: input.paymentNote,
      recipientEmail: input.customerEmail,
      sendEmail: Boolean(input.sendEmail && input.customerEmail)
    }
  });

  return payment.receipt;
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
    throw notFound('Transaction receipt not found');
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
