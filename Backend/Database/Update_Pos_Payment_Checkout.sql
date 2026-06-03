USE cloud_pos_db;

ALTER TABLE sales_transactions
    ADD COLUMN order_status ENUM('AWAITING_PAYMENT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED' AFTER total_amount,
    ADD COLUMN payment_method ENUM('CASH', 'BANK_TRANSFER') NULL AFTER payment_status,
    ADD COLUMN payment_reference VARCHAR(100) NULL AFTER payment_method,
    ADD COLUMN payment_note VARCHAR(255) NULL AFTER payment_reference,
    ADD COLUMN paid_at DATETIME NULL AFTER payment_note;

ALTER TABLE sales_transactions
    MODIFY payment_status ENUM('PAID', 'UNPAID', 'PENDING', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

UPDATE sales_transactions
SET order_status = CASE
        WHEN payment_status = 'PAID' THEN 'COMPLETED'
        ELSE 'AWAITING_PAYMENT'
    END,
    payment_status = CASE
        WHEN payment_status = 'PAID' THEN 'PAID'
        ELSE 'PENDING'
    END,
    payment_method = CASE
        WHEN payment_status = 'PAID' THEN 'CASH'
        ELSE NULL
    END,
    paid_at = CASE
        WHEN payment_status = 'PAID' THEN transaction_date
        ELSE NULL
    END;

ALTER TABLE sales_transactions
    MODIFY payment_status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

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
