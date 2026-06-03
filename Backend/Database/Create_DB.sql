CREATE DATABASE IF NOT EXISTS cloud_pos_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE cloud_pos_db;

CREATE TABLE IF NOT EXISTS platform_admins (
    platform_admin_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_platform_admins_username (username),
    UNIQUE KEY uq_platform_admins_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tenants (
    tenant_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_code VARCHAR(50) NOT NULL,
    tenant_name VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(100),
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_tenants_code (tenant_code),
    CONSTRAINT chk_tenants_code_not_blank CHECK (tenant_code <> ''),
    CONSTRAINT chk_tenants_name_not_blank CHECK (tenant_name <> '')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS users (
    user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('TENANT_ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_users_tenant_user (tenant_id, user_id),
    UNIQUE KEY uq_users_tenant_username (tenant_id, username),
    UNIQUE KEY uq_users_tenant_email (tenant_id, email),
    KEY idx_users_tenant_status (tenant_id, status),

    CONSTRAINT fk_users_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants (tenant_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_users_username_not_blank CHECK (username <> ''),
    CONSTRAINT chk_users_full_name_not_blank CHECK (full_name <> '')
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS products (
    product_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    sku VARCHAR(50),
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    status ENUM('AVAILABLE', 'UNAVAILABLE') NOT NULL DEFAULT 'AVAILABLE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_products_tenant_product (tenant_id, product_id),
    UNIQUE KEY uq_products_tenant_sku (tenant_id, sku),
    KEY idx_products_tenant_status (tenant_id, status),
    KEY idx_products_tenant_category (tenant_id, category),

    CONSTRAINT fk_products_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants (tenant_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_products_name_not_blank CHECK (product_name <> ''),
    CONSTRAINT chk_products_price_non_negative CHECK (price >= 0),
    CONSTRAINT chk_products_stock_non_negative CHECK (stock_quantity >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_transactions (
    transaction_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    customer_name VARCHAR(100),
    customer_email VARCHAR(100),
    subtotal DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    order_status ENUM('AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'AWAITING_PAYMENT',
    payment_status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    payment_method ENUM('CASH', 'BANK_TRANSFER') NULL,
    payment_reference VARCHAR(100),
    payment_note VARCHAR(255),
    paid_at DATETIME,
    transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_transactions_tenant_transaction (tenant_id, transaction_id),
    KEY idx_transactions_tenant_date (tenant_id, transaction_date),
    KEY idx_transactions_tenant_user (tenant_id, user_id),

    CONSTRAINT fk_transactions_tenant
        FOREIGN KEY (tenant_id)
        REFERENCES tenants (tenant_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_transactions_user_same_tenant
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES users (tenant_id, user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_transactions_subtotal_non_negative CHECK (subtotal >= 0),
    CONSTRAINT chk_transactions_total_non_negative CHECK (total_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transaction_details (
    detail_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    transaction_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    line_total DECIMAL(10, 2) NOT NULL,

    UNIQUE KEY uq_transaction_details_tenant_detail (tenant_id, detail_id),
    KEY idx_transaction_details_transaction (tenant_id, transaction_id),
    KEY idx_transaction_details_product (tenant_id, product_id),

    CONSTRAINT fk_transaction_details_transaction_same_tenant
        FOREIGN KEY (tenant_id, transaction_id)
        REFERENCES sales_transactions (tenant_id, transaction_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_transaction_details_product_same_tenant
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES products (tenant_id, product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_transaction_details_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_transaction_details_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT chk_transaction_details_line_total_non_negative CHECK (line_total >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    movement_type ENUM('ORDER_CREATED', 'ORDER_CANCELLED', 'SALE', 'ADJUSTMENT', 'RESTOCK', 'REFUND') NOT NULL,
    quantity_change INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reference_type ENUM('TRANSACTION', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    reference_id INT UNSIGNED,
    note VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_inventory_movements_tenant_movement (tenant_id, movement_id),
    KEY idx_inventory_movements_product (tenant_id, product_id, created_at),
    KEY idx_inventory_movements_reference (tenant_id, reference_type, reference_id),

    CONSTRAINT fk_inventory_movements_product_same_tenant
        FOREIGN KEY (tenant_id, product_id)
        REFERENCES products (tenant_id, product_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_inventory_movements_user_same_tenant
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES users (tenant_id, user_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_inventory_quantity_after_non_negative CHECK (quantity_after >= 0),
    CONSTRAINT chk_inventory_quantity_before_non_negative CHECK (quantity_before >= 0),
    CONSTRAINT chk_inventory_quantity_change_not_zero CHECK (quantity_change <> 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS receipts (
    receipt_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT UNSIGNED NOT NULL,
    transaction_id INT UNSIGNED NOT NULL,
    receipt_code VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(100),
    email_status ENUM('NOT_SENT', 'SENT', 'FAILED') NOT NULL DEFAULT 'NOT_SENT',
    email_provider_message_id VARCHAR(255),
    email_error TEXT,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,

    UNIQUE KEY uq_receipts_tenant_receipt (tenant_id, receipt_id),
    UNIQUE KEY uq_receipts_tenant_transaction (tenant_id, transaction_id),
    UNIQUE KEY uq_receipts_code (receipt_code),
    KEY idx_receipts_tenant_generated (tenant_id, generated_at),
    KEY idx_receipts_tenant_email_status (tenant_id, email_status),

    CONSTRAINT fk_receipts_transaction_same_tenant
        FOREIGN KEY (tenant_id, transaction_id)
        REFERENCES sales_transactions (tenant_id, transaction_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT chk_receipts_code_not_blank CHECK (receipt_code <> '')
) ENGINE=InnoDB;
