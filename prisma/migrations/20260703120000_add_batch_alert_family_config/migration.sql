-- Per-area batch utilization alert overrides (null = inherit global settings)
ALTER TABLE "inventory_family_config"
  ADD COLUMN IF NOT EXISTS "batch_utilization_alert_enabled" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "batch_utilization_email_critical" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "batch_utilization_email_warning" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "batch_low_stock_threshold_pct" DOUBLE PRECISION;
