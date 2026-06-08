USE cloud_pos_db;

ALTER TABLE transaction_details
ADD COLUMN product_name VARCHAR(100) NULL AFTER product_id;

UPDATE transaction_details td
JOIN products p
  ON p.tenant_id = td.tenant_id
 AND p.product_id = td.product_id
SET td.product_name = p.product_name
WHERE td.product_name IS NULL;

ALTER TABLE transaction_details
MODIFY product_name VARCHAR(100) NOT NULL;
