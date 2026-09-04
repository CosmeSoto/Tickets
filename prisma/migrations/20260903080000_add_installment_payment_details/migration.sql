-- Los abonos de equipment_invoice_installments/license_invoice_installments
-- solo guardaban payment_method + reference_number + notes: el modal
-- "Registrar pago" pide banco/entidad y últimos 4 dígitos de tarjeta para
-- CORPORATE_CARD, pero al no existir estas columnas ese dato se descartaba
-- en silencio en el service (ver registerPayment). Se agregan las mismas
-- columnas que ya tienen equipment_invoices/license_invoices (la factura),
-- ahora también a nivel de cada abono individual.

-- AlterTable
ALTER TABLE "equipment_invoice_installments" ADD COLUMN "bank_entity" VARCHAR(100),
ADD COLUMN "card_last4" VARCHAR(4),
ADD COLUMN "card_brand" VARCHAR(50),
ADD COLUMN "transaction_id" VARCHAR(200);

-- AlterTable
ALTER TABLE "license_invoice_installments" ADD COLUMN "bank_entity" VARCHAR(100),
ADD COLUMN "card_last4" VARCHAR(4),
ADD COLUMN "card_brand" VARCHAR(50),
ADD COLUMN "transaction_id" VARCHAR(200);
