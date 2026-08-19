-- Cheque como método de pago (proveedores y contratos).
ALTER TYPE "PaymentMethodType" ADD VALUE IF NOT EXISTS 'CHECK';
