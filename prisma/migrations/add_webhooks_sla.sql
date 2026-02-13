-- ============================================
-- WEBHOOKS SYSTEM
-- ============================================

-- Tabla de webhooks
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  headers JSONB,
  timeout_ms INTEGER DEFAULT 30000,
  retry_count INTEGER DEFAULT 3,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_triggered_at TIMESTAMP
);

-- Tabla de logs de webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  event VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON webhook_logs(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event ON webhook_logs(event, created_at DESC);

-- ============================================
-- SLA SYSTEM
-- ============================================

-- Tabla de políticas SLA
CREATE TABLE IF NOT EXISTS sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  response_time_hours INTEGER NOT NULL,
  resolution_time_hours INTEGER NOT NULL,
  business_hours_only BOOLEAN DEFAULT false,
  business_hours_start TIME DEFAULT '09:00:00',
  business_hours_end TIME DEFAULT '18:00:00',
  business_days VARCHAR(50) DEFAULT 'MON,TUE,WED,THU,FRI',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de violaciones SLA
CREATE TABLE IF NOT EXISTS sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  sla_policy_id UUID REFERENCES sla_policies(id),
  violation_type VARCHAR(50) NOT NULL CHECK (violation_type IN ('RESPONSE', 'RESOLUTION')),
  expected_at TIMESTAMP NOT NULL,
  actual_at TIMESTAMP,
  is_resolved BOOLEAN DEFAULT false,
  severity VARCHAR(20) DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  notified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de métricas SLA por ticket
CREATE TABLE IF NOT EXISTS ticket_sla_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  sla_policy_id UUID REFERENCES sla_policies(id),
  response_deadline TIMESTAMP,
  resolution_deadline TIMESTAMP,
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  response_sla_met BOOLEAN,
  resolution_sla_met BOOLEAN,
  response_time_minutes INTEGER,
  resolution_time_minutes INTEGER,
  business_hours_elapsed INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para SLA
CREATE INDEX IF NOT EXISTS idx_sla_policies_active ON sla_policies(is_active, category_id, priority);
CREATE INDEX IF NOT EXISTS idx_sla_violations_ticket ON sla_violations(ticket_id, is_resolved);
CREATE INDEX IF NOT EXISTS idx_sla_violations_policy ON sla_violations(sla_policy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_metrics_ticket ON ticket_sla_metrics(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_sla_metrics_deadlines ON ticket_sla_metrics(response_deadline, resolution_deadline);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sla_policies_updated_at
  BEFORE UPDATE ON sla_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_sla_metrics_updated_at
  BEFORE UPDATE ON ticket_sla_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios
COMMENT ON TABLE webhooks IS 'Configuración de webhooks para integraciones externas';
COMMENT ON TABLE webhook_logs IS 'Logs de ejecución de webhooks';
COMMENT ON TABLE sla_policies IS 'Políticas de SLA por categoría y prioridad';
COMMENT ON TABLE sla_violations IS 'Registro de violaciones de SLA';
COMMENT ON TABLE ticket_sla_metrics IS 'Métricas de SLA por ticket';

-- Datos de ejemplo para SLA (opcional)
INSERT INTO sla_policies (name, description, priority, response_time_hours, resolution_time_hours, business_hours_only)
VALUES 
  ('SLA Urgente', 'Tickets urgentes requieren respuesta inmediata', 'URGENT', 1, 4, false),
  ('SLA Alta Prioridad', 'Tickets de alta prioridad', 'HIGH', 2, 8, true),
  ('SLA Media Prioridad', 'Tickets de prioridad media', 'MEDIUM', 4, 24, true),
  ('SLA Baja Prioridad', 'Tickets de baja prioridad', 'LOW', 8, 48, true)
ON CONFLICT DO NOTHING;
