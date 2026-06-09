# Frontend Implementation Prompt: POS Payment Checkout

You are working on the React frontend of a multi-tenant SaaS POS application.

The backend has been updated to support a separated POS order creation and payment checkout flow. Your task is to update the frontend UI while preserving the existing authentication flow and overall dashboard structure.

## Current Stack

- Frontend: React + Vite
- Backend API: Express
- Auth: JWT stored in local storage by the existing frontend
- Existing frontend root: `frontend/src`
- Existing tenant pages: `frontend/src/pages/TenantPages.jsx`

## Goal

Refactor the tenant POS workflow into two separate steps:

1. Create order from POS cart.
2. Move to a payment checkout screen.
3. Select payment method.
4. Confirm payment.
5. Show receipt and optionally send receipt email.

Payment methods currently supported:

- `CASH`
- `BANK_TRANSFER`

## UX Flow

### 1. POS Order Creation

Update the current POS page:

- Staff selects products and builds cart.
- Staff enters optional customer name and customer email.
- Button label should become `Create order` instead of `Complete sale`.
- On submit, call `POST /api/tenant/orders`.
- After success, navigate to a new checkout view/page with the returned `order.transaction_id`.

Suggested route/view name:

- `checkout`
- or `payment-checkout`

Expected request:

```json
{
  "customerName": "Nguyen Van A",
  "customerEmail": "customer@example.com",
  "items": [
    { "productId": 1, "quantity": 2 },
    { "productId": 3, "quantity": 1 }
  ]
}
```

Expected response:

```json
{
  "order": {
    "transaction_id": 123,
    "order_status": "AWAITING_PAYMENT",
    "payment_status": "PENDING",
    "subtotal": 10.5,
    "total_amount": 10.5,
    "items": []
  }
}
```

### 2. Payment Checkout Page

Create a new payment checkout view.

This screen should show:

- Order ID.
- Customer name/email.
- Item list.
- Subtotal and total.
- Current status: `AWAITING_PAYMENT` and `PENDING`.
- Payment method selector with `Cash` and `Bank transfer`.
- Optional payment reference input, especially useful for bank transfer.
- Optional payment note.
- Optional checkbox: send receipt email.
- Confirm payment button.
- Cancel order button for pending orders.

Load order detail:

```http
GET /api/tenant/orders/:transactionId
```

Load payment methods:

```http
GET /api/tenant/orders/payment-methods
```

Confirm payment:

```http
POST /api/tenant/orders/:transactionId/payment
```

Request:

```json
{
  "paymentMethod": "CASH",
  "paymentReference": "",
  "paymentNote": "",
  "recipientEmail": "customer@example.com",
  "sendEmail": true
}
```

For bank transfer:

```json
{
  "paymentMethod": "BANK_TRANSFER",
  "paymentReference": "BANK-TXN-20260603-0001",
  "paymentNote": "Paid via Vietcombank QR",
  "recipientEmail": "customer@example.com",
  "sendEmail": true
}
```

Expected response:

```json
{
  "order": {
    "transaction_id": 123,
    "order_status": "COMPLETED",
    "payment_status": "PAID",
    "payment_method": "CASH"
  },
  "receipt": {
    "receipt_id": 1,
    "receipt_code": "R-1-123-ABC",
    "email_status": "SENT",
    "items": []
  }
}
```

After successful payment:

- Show receipt view.
- Show email status.
- Provide button to go back to POS.
- Provide button to view transaction history.

Cancel pending order:

```http
POST /api/tenant/orders/:transactionId/cancel
```

Request:

```json
{
  "reason": "Customer changed their mind"
}
```

After cancel:

- Show order status `CANCELLED`.
- Disable payment button.
- Navigate back to POS or transaction history.

## Inventory Management UI

Add or prepare an Inventory page for tenant admins.

Backend endpoints:

```http
GET /api/tenant/inventory/products
GET /api/tenant/inventory/movements
GET /api/tenant/inventory/movements?productId=1
POST /api/tenant/inventory/adjustments
```

Adjustment request:

```json
{
  "productId": 1,
  "quantityChange": 20,
  "movementType": "RESTOCK",
  "note": "Restocked from supplier"
}
```

For reducing stock manually:

```json
{
  "productId": 1,
  "quantityChange": -3,
  "movementType": "ADJUSTMENT",
  "note": "Damaged items"
}
```

Inventory page should show:

- Product name.
- SKU.
- Current stock quantity.
- Product status.
- Last movement date.
- Movement history table.
- Manual stock adjustment form for tenant admins.

## Existing Endpoints Still Available

The old transaction endpoint still works as a quick-sale compatibility endpoint:

```http
POST /api/tenant/transactions
```

However, new frontend work should prefer:

- `POST /api/tenant/orders`
- `POST /api/tenant/orders/:transactionId/payment`

## Visual Direction

Keep the current React dashboard style consistent:

- Operational SaaS dashboard, not landing-page style.
- Compact and scannable.
- Clear checkout status.
- Payment method selector should be visually obvious.
- Bank transfer should reveal reference/note fields clearly.
- Use existing buttons, panels, status badges, and table styling.

## Important Frontend Notes

- Do not send `tenantId` from the frontend. Backend gets tenant from JWT.
- Use the existing `apiCall` helper pattern.
- Preserve current login and dashboard shell.
- Make checkout accessible by keyboard.
- Show loading states during order creation and payment confirmation.
- Show clear error messages from backend responses.
- Keep responsive behavior for mobile and desktop.
