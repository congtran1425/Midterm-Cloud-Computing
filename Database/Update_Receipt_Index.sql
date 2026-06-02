USE cloud_pos_db;

ALTER TABLE receipts
    DROP INDEX uq_receipts_transaction;

ALTER TABLE receipts
    ADD UNIQUE KEY uq_receipts_tenant_transaction (tenant_id, transaction_id);
