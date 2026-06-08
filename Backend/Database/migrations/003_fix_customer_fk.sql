-- Add missing unique key to customers table
ALTER TABLE customers
ADD UNIQUE KEY uq_customers_tenant_customer (tenant_id, customer_id);

-- Retry adding the foreign key constraint
ALTER TABLE sales_transactions
ADD CONSTRAINT fk_transactions_customer_same_tenant
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES customers (tenant_id, customer_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
