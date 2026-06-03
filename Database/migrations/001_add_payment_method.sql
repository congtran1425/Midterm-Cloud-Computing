-- Run on RDS/local MySQL before deploying backend that writes payment_method.
ALTER TABLE sales_transactions
  ADD COLUMN payment_method ENUM('CASH', 'BANK_CARD', 'BANK_TRANSFER', 'E_WALLET') NOT NULL DEFAULT 'CASH'
  AFTER payment_status;
