-- Elimina "cancellation_notice_days": se pedía en el formulario de contrato
-- (sección Pagos y facturación) como un segundo campo de "días de aviso",
-- separado de "renewal_notice_days" (sección Vigencia y costos), pero nunca
-- alimentó ninguna alerta ni regla de negocio — quedó a medio implementar y
-- solo confundía al pedir el mismo dato dos veces. "renewal_notice_days" es
-- ahora el único campo de días de aviso del contrato.

-- AlterTable
ALTER TABLE "contracts" DROP COLUMN "cancellation_notice_days";
