import { getOne, query } from '../config/db.js';
import { notFound } from '../utils/httpError.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const formatDate = (value) => new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
}).format(new Date(value));

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export const money = (value) => currencyFormatter.format(Number(value || 0));

export const makeReceiptCode = (tenantId, transactionId) => {
  const stamp = Date.now().toString(36).toUpperCase();
  return `R-${tenantId}-${transactionId}-${stamp}`;
};

export const getReceiptPayload = async ({ tenantId, receiptId, transactionId }) => {
  const whereClause = receiptId ? 'r.receipt_id = ?' : 'r.transaction_id = ?';
  const whereValue = receiptId || transactionId;

  const receipt = await getOne(
    `SELECT
        r.receipt_id,
        r.receipt_code,
        r.recipient_email,
        r.email_status,
        r.generated_at,
        r.sent_at,
        tx.transaction_id,
        tx.customer_name,
        tx.customer_email,
        tx.subtotal,
        tx.total_amount,
        tx.payment_status,
        tx.transaction_date,
        t.tenant_id,
        t.tenant_code,
        t.tenant_name,
        t.address,
        t.phone,
        t.email AS tenant_email,
        u.full_name AS cashier_name
      FROM receipts r
      JOIN sales_transactions tx
        ON tx.tenant_id = r.tenant_id
       AND tx.transaction_id = r.transaction_id
      JOIN tenants t
        ON t.tenant_id = tx.tenant_id
      JOIN users u
        ON u.tenant_id = tx.tenant_id
       AND u.user_id = tx.user_id
      WHERE r.tenant_id = ?
        AND ${whereClause}`,
    [tenantId, whereValue]
  );

  if (!receipt) {
    throw notFound('Receipt not found');
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
    [tenantId, receipt.transaction_id]
  );

  return {
    ...receipt,
    transaction_date_display: formatDate(receipt.transaction_date),
    generated_at_display: formatDate(receipt.generated_at),
    subtotal_display: money(receipt.subtotal),
    total_amount_display: money(receipt.total_amount),
    items: items.map((item) => ({
      ...item,
      unit_price_display: money(item.unit_price),
      line_total_display: money(item.line_total)
    }))
  };
};

export const renderReceiptText = (receipt) => {
  const itemLines = receipt.items
    .map((item) => `${item.product_name} x ${item.quantity} @ ${money(item.unit_price)} = ${money(item.line_total)}`)
    .join('\n');

  return [
    receipt.tenant_name,
    receipt.address || '',
    receipt.phone || '',
    '',
    `Receipt: ${receipt.receipt_code}`,
    `Transaction: ${receipt.transaction_id}`,
    `Date: ${receipt.transaction_date_display}`,
    `Cashier: ${receipt.cashier_name}`,
    '',
    itemLines,
    '',
    `Subtotal: ${receipt.subtotal_display}`,
    `Total: ${receipt.total_amount_display}`,
    '',
    'Thank you for your purchase.'
  ].filter(Boolean).join('\n');
};

export const renderReceiptHtml = (receipt) => {
  const rows = receipt.items.map((item) => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.product_name)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${item.unit_price_display}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;">${item.line_total_display}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111827;">
      <h2 style="margin-bottom:4px;">${escapeHtml(receipt.tenant_name)}</h2>
      <p style="margin-top:0;color:#4b5563;">${escapeHtml(receipt.address || '')}</p>
      <p><strong>Receipt:</strong> ${escapeHtml(receipt.receipt_code)}<br>
      <strong>Transaction:</strong> ${receipt.transaction_id}<br>
      <strong>Date:</strong> ${receipt.transaction_date_display}<br>
      <strong>Cashier:</strong> ${escapeHtml(receipt.cashier_name)}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding-bottom:8px;">Item</th>
            <th style="text-align:center;padding-bottom:8px;">Qty</th>
            <th style="text-align:right;padding-bottom:8px;">Price</th>
            <th style="text-align:right;padding-bottom:8px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="text-align:right;font-size:16px;">
        Subtotal: <strong>${receipt.subtotal_display}</strong><br>
        Total: <strong>${receipt.total_amount_display}</strong>
      </p>
      <p style="color:#4b5563;">Thank you for your purchase.</p>
    </div>
  `;
};
