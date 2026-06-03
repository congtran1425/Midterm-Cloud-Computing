# Core Features and Enhancement Proposals

## 1. Project Overview

This project is a multi-tenant SaaS Point-of-Sale (POS) web application. The system is designed for multiple independent shops or companies to use the same platform while keeping each tenant's data isolated.

Current technology stack:

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MySQL
- Email: SMTP-ready, suitable for AWS SES SMTP
- Deployment target: AWS

Main user groups:

- System Admin: manages the SaaS platform, tenants, and tenant users.
- Tenant Admin: manages one tenant's products, users, sales, and receipts.
- Staff: uses the POS flow to create sales transactions.
- Customer: receives digital receipts by email.

## 2. Core Features Currently Available

### 2.1 Authentication and Role-Based Access

The system supports separate login flows for platform administrators and tenant users.

Current capabilities:

- System Admin login.
- Tenant User login using tenant code, username, and password.
- JWT-based authentication.
- Role-based access for platform admin, tenant admin, and tenant user.
- Tenant identity is taken from the authenticated token, not from client input.

Purpose:

- Prevents users from accessing data from another tenant.
- Separates platform-level permissions from tenant-level permissions.

### 2.2 Multi-Tenant Data Isolation

The project supports multi-tenancy through tenant-specific data ownership.

Current capabilities:

- Each tenant has its own tenant record.
- Tenant users, products, transactions, transaction details, and receipts are linked to a tenant.
- Backend APIs filter tenant data by authenticated `tenant_id`.
- Database constraints help prevent cross-tenant relationships between users, products, transactions, and receipts.

Purpose:

- Ensures each shop/company only sees and manages its own data.
- Satisfies the mandatory multi-tenant requirement of the assignment.

### 2.3 System Admin Dashboard

The System Admin can manage the SaaS platform.

Current capabilities:

- View platform overview metrics.
- View total tenants, tenant users, products, and transactions.
- Create tenants.
- Create the first tenant admin account during tenant creation.
- Activate or deactivate tenants.
- View tenant users across the platform.
- Create tenant users from the platform side.

Purpose:

- Allows platform-level management of the SaaS application.
- Supports onboarding new shops/companies into the system.

### 2.4 Tenant User Dashboard

Tenant users can access tenant-specific POS operations.

Current capabilities:

- Tenant dashboard navigation.
- POS sales screen.
- Product management screen.
- Transaction and receipt history screen.
- Team management screen for tenant admins.

Purpose:

- Provides tenant users with the tools needed to operate their store.

### 2.5 Product Management

Tenant users can manage products for their own tenant.

Current capabilities:

- Create products.
- Edit products.
- Search/filter products in the POS interface.
- Store product information such as SKU, name, category, description, price, stock quantity, and status.
- Mark products as available or unavailable.

Purpose:

- Supports the product catalog needed for POS sales.

### 2.6 POS Transaction Processing

The POS module supports both the existing quick-sale flow and the newer separated order/payment flow.

Current capabilities:

- Add products to cart.
- Increase or decrease item quantity.
- Remove items from cart.
- Enter customer name and customer email.
- Automatically calculate subtotal and total.
- Create an order with `AWAITING_PAYMENT` and `PENDING` status.
- Complete legacy quick-sale transactions through the existing transaction endpoint.
- Reduce stock when an order is created.
- Generate receipt after successful payment.

Purpose:

- Covers the core POS workflow required by the assignment.
- Supports a more realistic two-step POS workflow for future frontend checkout.

### 2.6.1 Payment Checkout Flow

The backend now supports a separate payment checkout step after order creation.

Current capabilities:

- Create order first, then process payment later.
- Support payment methods: `CASH` and `BANK_TRANSFER`.
- Store order status: `AWAITING_PAYMENT`, `COMPLETED`, `CANCELLED`.
- Store payment status: `PENDING`, `PAID`, `FAILED`, `CANCELLED`.
- Store payment method, payment reference, payment note, and paid timestamp.
- Cancel pending orders and restore stock.
- Generate receipt only after successful payment.
- Keep the old quick-sale transaction endpoint as a compatibility endpoint.

Main backend endpoints:

- `POST /api/tenant/orders`
- `GET /api/tenant/orders`
- `GET /api/tenant/orders/:transactionId`
- `POST /api/tenant/orders/:transactionId/payment`
- `POST /api/tenant/orders/:transactionId/cancel`

Purpose:

- Makes POS more realistic by separating order creation from payment confirmation.
- Allows the frontend team to build a dedicated payment checkout page.
- Prepares the system for more payment methods in the future.

### 2.7 Receipt Generation

The system generates a digital receipt for each completed transaction.

Current capabilities:

- Generate unique receipt code.
- Store receipt information in the database.
- Display receipt details in the transaction screen.
- Show tenant/store information, purchased items, quantity, price, total amount, cashier, date, and receipt code.

Purpose:

- Provides proof of purchase for customers and transaction records for tenants.

### 2.8 Email Receipt Sending

The system supports sending receipt emails through SMTP.

Current capabilities:

- Send receipt email after completing a transaction.
- Resend receipt email from transaction detail screen.
- Store email status as `NOT_SENT`, `SENT`, or `FAILED`.
- Store provider message ID and email error message.
- SMTP configuration through environment variables.

Purpose:

- Satisfies the email receipt sending requirement.
- Supports AWS SES SMTP integration later.

### 2.9 Team Management

Tenant admins can manage users inside their own tenant.

Current capabilities:

- View tenant team members.
- Create tenant users.
- Assign role as `TENANT_ADMIN` or `STAFF`.
- Store user status as active or inactive.

Purpose:

- Allows each tenant to manage its staff accounts.

### 2.9.1 Inventory Management

The backend now supports inventory management and inventory movement history.

Current capabilities:

- View inventory product list.
- View inventory movement history.
- Filter inventory movement history by product.
- Manually adjust stock for tenant admins.
- Record stock movements when an order is created.
- Restore stock and record movement when a pending order is cancelled.
- Track movement type, quantity change, quantity before, quantity after, actor, reference type, reference ID, note, and timestamp.

Main backend endpoints:

- `GET /api/tenant/inventory/products`
- `GET /api/tenant/inventory/movements`
- `POST /api/tenant/inventory/adjustments`

Purpose:

- Makes stock changes auditable.
- Supports the non-functional requirement for data consistency.
- Creates a foundation for restock, refund, and supplier workflows.

### 2.10 Data Consistency and Transaction Safety

The backend includes logic to protect transaction consistency.

Current capabilities:

- Product rows are locked during transaction creation.
- Stock is checked before order creation.
- Order creation, transaction details, stock reservation, and inventory movement records are handled inside a database transaction.
- Payment confirmation updates payment status and receipt generation consistently.
- Pending order cancellation restores stock inside a database transaction.
- If order/payment/cancel logic fails, database changes are rolled back.

Purpose:

- Prevents inconsistent stock and transaction records.
- Supports the non-functional requirement for data consistency.

### 2.11 React Frontend

The frontend has been upgraded from vanilla JavaScript to React.

Current capabilities:

- Component-based UI.
- Separate pages for login, platform dashboard, tenant POS, products, transactions, and team management.
- Responsive layout.
- Vite development server for frontend development.
- Express can serve the production React build.

Purpose:

- Improves maintainability and UI scalability.
- Makes the frontend easier to extend.

### 2.12 Backend API Structure

The backend is organized into routes and services.

Current capabilities:

- Thin Express routes.
- Business logic separated into service files.
- Shared utilities for authentication, password hashing, errors, and SQL update helpers.
- API endpoints for auth, admin, tenant profile, products, users, transactions, orders, payment checkout, inventory, and receipts.

Purpose:

- Improves backend maintainability.
- Makes future feature development easier.

## 3. Suggested Additional Features

### 3.1 Separate Order Creation and Payment Flow

Implementation status: Backend/API implemented. Frontend payment checkout page is pending.

Current POS flow can now be split into two steps:

1. Create order.
2. Process payment.

Proposed flow:

- Staff adds products to cart.
- Staff creates an order.
- System moves to a payment screen.
- Staff chooses payment method.
- System confirms payment.
- System generates receipt.
- System sends receipt email if requested.

Suggested payment methods:

- Cash
- Credit/debit card
- Bank transfer
- E-wallet
- QR code payment

Suggested database changes:

- Added payment method to transactions.
- Added payment statuses such as `PENDING`, `PAID`, `FAILED`, and `CANCELLED`.
- Added fields such as `paid_at`, `payment_reference`, and `payment_note`.

Why this is useful:

- More realistic POS workflow.
- Easier to support unpaid orders, failed payments, and refunds later.
- Improves usability because staff can review the order before payment.

Priority: High for frontend implementation

### 3.2 Upgrade Email Receipt Functionality

The current email function works as a basic receipt sender. It can be improved into a more complete customer communication feature.

Suggested improvements:

- Use AWS SES for production email delivery.
- Add professional HTML email template.
- Add tenant logo and store branding.
- Add receipt PDF attachment.
- Add email resend history.
- Add email delivery logs.
- Add support for failed email retry.
- Add validation for customer email before sending.
- Allow tenant admin to configure sender name and reply-to email.

Why this is useful:

- Better demonstration quality.
- More professional customer experience.
- Stronger cloud integration with AWS SES.

Priority: High

### 3.3 Discount, Tax, and Service Charge

The current transaction only supports subtotal and total with no adjustments.

Suggested improvements:

- Add item-level discount.
- Add order-level discount.
- Add tax percentage.
- Add service charge.
- Show subtotal, discount, tax, service charge, and final total separately.

Suggested database changes:

- Add `discount_amount`, `tax_amount`, and `service_charge` to transactions.
- Add `discount_amount` to transaction details for item-level discounts.

Why this is useful:

- More realistic retail workflow.
- Gives a stronger business logic demonstration.

Priority: Medium

### 3.4 Refund and Cancel Transaction

The current system does not support refunding or cancelling a completed sale.

Suggested improvements:

- Cancel unpaid order.
- Refund paid transaction.
- Restore stock when a transaction is cancelled or refunded.
- Store refund reason.
- Store refund date and refunded by user.

Suggested database changes:

- Add transaction status such as `COMPLETED`, `CANCELLED`, `REFUNDED`.
- Add refund fields or a separate `refunds` table.

Why this is useful:

- Handles common real-world POS scenarios.
- Improves data traceability.

Priority: Medium

### 3.5 Inventory Management

Implementation status: Backend/API implemented. Frontend inventory screen is pending.

The current system now records stock movement history, but inventory management can be expanded.

Suggested improvements:

- Low stock warning.
- Manual stock adjustment.
- Stock import history.
- Stock movement logs.
- Supplier or purchase order tracking.

Suggested database changes:

- Added `inventory_movements` table.
- Store movement type such as `ORDER_CREATED`, `ORDER_CANCELLED`, `ADJUSTMENT`, `RESTOCK`, and `REFUND`.

Why this is useful:

- Makes stock changes auditable.
- Helps tenants manage product availability.

Priority: Medium

### 3.6 Customer Management

The current system stores customer name and email inside each transaction.

Suggested improvements:

- Add customer profile management.
- Store customer phone number.
- View customer purchase history.
- Reuse customer information during checkout.

Suggested database changes:

- Add `customers` table.
- Link transactions to `customer_id`.

Why this is useful:

- Better customer tracking.
- Useful for receipt history and loyalty features.

Priority: Medium

### 3.7 Sales Reports and Analytics

The current dashboard includes simple overview metrics.

Suggested improvements:

- Daily revenue report.
- Monthly revenue report.
- Best-selling products.
- Sales by staff.
- Sales by payment method.
- Export report to CSV or PDF.

Why this is useful:

- Improves tenant decision-making.
- Strengthens the project demonstration.

Priority: Medium

### 3.8 Advanced Role and Permission Management

The current role model has `TENANT_ADMIN` and `STAFF`.

Suggested improvements:

- Add custom permissions.
- Add roles such as `MANAGER`, `CASHIER`, and `INVENTORY_STAFF`.
- Restrict product management to tenant admin or manager.
- Restrict refunds to tenant admin or manager.

Why this is useful:

- More realistic access control.
- Improves security.

Priority: Medium

### 3.9 Audit Logs

The current system does not store a detailed audit trail.

Suggested improvements:

- Log important actions such as login, tenant creation, product update, transaction creation, refund, and email resend.
- Store actor user, tenant, action type, timestamp, and metadata.

Suggested database changes:

- Add `audit_logs` table.

Why this is useful:

- Supports traceability.
- Helps with debugging and security review.

Priority: Medium

### 3.10 Better Validation and Error Handling

The backend currently validates some required fields manually.

Suggested improvements:

- Add request validation using Zod or Joi.
- Standardize API error responses.
- Return `409 Conflict` for duplicate tenant code, username, SKU, or email.
- Return clearer frontend messages for validation errors.

Why this is useful:

- Improves reliability.
- Reduces backend bugs.
- Improves user experience.

Priority: High

### 3.11 Password and Account Security

The current system supports hashed passwords and JWT authentication.

Suggested improvements:

- Password reset by email.
- Change password screen.
- Login rate limiting.
- Account lock after too many failed attempts.
- Stronger JWT secret policy in production.
- Optional refresh token flow.

Why this is useful:

- Improves security.
- Supports the non-functional requirement for security.

Priority: Medium

### 3.12 Cloud Deployment Improvements

The project is designed for AWS deployment, but cloud production features can be expanded.

Suggested improvements:

- Deploy MySQL on Amazon RDS.
- Deploy backend on EC2 or Elastic Beanstalk.
- Deploy React frontend on S3 + CloudFront, or serve React build from Express for simpler deployment.
- Use AWS SES for receipt emails.
- Store environment variables securely.
- Add HTTPS with AWS Certificate Manager.
- Add CloudWatch logging.
- Add automated database backup.

Why this is useful:

- Supports cloud deployment, availability, scalability, and maintainability.
- Makes the project more production-like.

Priority: High

### 3.13 Accessibility and Usability Enhancements

The current React UI is functional and responsive, but it can be improved further.

Suggested improvements:

- Improve keyboard navigation.
- Add loading states for every action.
- Add confirmation dialogs for sensitive actions.
- Improve color contrast where needed.
- Add form-level validation messages.
- Add empty states with clear next actions.
- Add print-friendly receipt view.

Why this is useful:

- Supports the web accessibility and usability non-functional requirements.
- Improves demo quality.

Priority: Medium

## 4. Recommended Development Roadmap

### Phase 1: Stabilize Current System

Recommended tasks:

- Add request validation with Zod or Joi.
- Improve backend error responses.
- Add duplicate key error handling.
- Restrict product management to tenant admin if needed.
- Add more seed data for demo.

Reason:

- These changes improve reliability without changing the core workflow too much.

### Phase 2: Improve POS Workflow

Recommended tasks:

- Backend/API for separated order creation and payment has been added.
- Build the React payment checkout screen.
- Add payment method selection in the frontend.
- Show order status and payment status clearly.
- Generate and display receipt after successful payment.

Reason:

- This is the most valuable functional upgrade because it makes the POS workflow more realistic.

### Phase 3: Upgrade Receipt and Email

Recommended tasks:

- Use AWS SES SMTP.
- Improve email template.
- Add PDF receipt.
- Add email retry and delivery history.

Reason:

- This strengthens the cloud computing part of the project and improves customer-facing quality.

### Phase 4: Add Business Enhancements

Recommended tasks:

- Add discounts and tax.
- Add refund/cancel transaction.
- Add inventory movement logs.
- Add sales reports.

Reason:

- These features make the application feel closer to a real POS SaaS product.

### Phase 5: Production and Cloud Hardening

Recommended tasks:

- Deploy on AWS.
- Configure RDS, SES, HTTPS, and CloudWatch.
- Add backups and monitoring.
- Add CI/CD if time allows.

Reason:

- This supports the cloud deployment, availability, scalability, and maintainability requirements.

## 5. Highest-Value Next Features

The best next features to build are:

1. Separate payment flow from POS order creation.
2. Build the frontend payment checkout screen.
3. Improve email receipt with AWS SES and better templates.
4. Add request validation and clearer backend errors.
5. Add sales report and best-selling product report.

These features provide the strongest balance between assignment value, real-world usefulness, and demonstration quality.
