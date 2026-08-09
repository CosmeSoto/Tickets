-- Align supplier_types.order default with other catalogs (max+1 creates; no 999 pin)
ALTER TABLE "supplier_types" ALTER COLUMN "order" SET DEFAULT 0;

-- Dashboard maintenance look-ahead window (independent of warranty alerts)
INSERT INTO "system_settings" ("id", "key", "value", "description", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'inventory.maintenance_alert_days',
  '30',
  'Días de anticipación para mantenimientos programados (dashboard)',
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
