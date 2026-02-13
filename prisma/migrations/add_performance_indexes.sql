-- ============================================
-- ÍNDICES DE RENDIMIENTO ADICIONALES
-- Optimiza las consultas más frecuentes del sistema
-- ============================================

-- Índices para búsquedas de texto completo
CREATE INDEX IF NOT EXISTS idx_tickets_title_description_gin 
  ON tickets USING gin(to_tsvector('spanish', title || ' ' || description));

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_content_gin 
  ON knowledge_articles USING gin(to_tsvector('spanish', title || ' ' || content));

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority_created 
  ON tickets(status, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_assignee_status_priority 
  ON tickets(assignee_id, status, priority) 
  WHERE assignee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_client_status_created 
  ON tickets(client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_category_status_created 
  ON tickets(category_id, status, created_at DESC);

-- Índices para SLA
CREATE INDEX IF NOT EXISTS idx_ticket_sla_metrics_deadlines_pending 
  ON ticket_sla_metrics(response_deadline, resolution_deadline) 
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_violations_unresolved 
  ON sla_violations(ticket_id, severity, created_at DESC) 
  WHERE is_resolved = false;

-- Índices para webhooks
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_status 
  ON webhook_logs(created_at DESC, response_status);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_event 
  ON webhook_logs(webhook_id, event, created_at DESC);

-- Índices para email queue
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled 
  ON email_queue(status, scheduled_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_queue_failed 
  ON email_queue(status, attempts, created_at DESC) 
  WHERE status = 'failed';

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created 
  ON audit_logs(entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_created 
  ON audit_logs(user_id, action, created_at DESC);

-- Índices para comentarios
CREATE INDEX IF NOT EXISTS idx_comments_ticket_created_internal 
  ON comments(ticket_id, created_at DESC, is_internal);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, is_read, created_at DESC) 
  WHERE is_read = false;

-- Índices para attachments
CREATE INDEX IF NOT EXISTS idx_attachments_ticket_created 
  ON attachments(ticket_id, created_at DESC);

-- Índices para ticket history
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_created 
  ON ticket_history(ticket_id, created_at DESC);

-- Índices para knowledge articles
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category_published 
  ON knowledge_articles(category_id, is_published, views DESC) 
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_knowledge_articles_helpful 
  ON knowledge_articles(helpful_votes DESC, created_at DESC) 
  WHERE is_published = true;

-- Índices para technician assignments
CREATE INDEX IF NOT EXISTS idx_technician_assignments_active 
  ON technician_assignments(technician_id, is_active, auto_assign) 
  WHERE is_active = true AND auto_assign = true;

-- Índices para user settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user 
  ON user_settings(user_id);

-- Índices para sessions (optimizar autenticación)
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires 
  ON sessions(user_id, expires) 
  WHERE expires > CURRENT_TIMESTAMP;

-- ============================================
-- ESTADÍSTICAS Y MANTENIMIENTO
-- ============================================

-- Actualizar estadísticas de las tablas principales
ANALYZE tickets;
ANALYZE comments;
ANALYZE users;
ANALYZE categories;
ANALYZE ticket_sla_metrics;
ANALYZE webhooks;
ANALYZE webhook_logs;
ANALYZE email_queue;
ANALYZE audit_logs;
ANALYZE knowledge_articles;

-- ============================================
-- COMENTARIOS SOBRE ÍNDICES
-- ============================================

COMMENT ON INDEX idx_tickets_title_description_gin IS 
  'Índice GIN para búsqueda de texto completo en tickets';

COMMENT ON INDEX idx_tickets_status_priority_created IS 
  'Índice compuesto para listados de tickets filtrados por estado y prioridad';

COMMENT ON INDEX idx_ticket_sla_metrics_deadlines_pending IS 
  'Índice para encontrar tickets próximos a vencer SLA';

COMMENT ON INDEX idx_webhook_logs_created_status IS 
  'Índice para consultas de logs de webhooks ordenados por fecha';

COMMENT ON INDEX idx_email_queue_status_scheduled IS 
  'Índice parcial para procesar cola de emails pendientes';

COMMENT ON INDEX idx_notifications_user_unread IS 
  'Índice parcial para notificaciones no leídas por usuario';

COMMENT ON INDEX idx_knowledge_articles_category_published IS 
  'Índice para artículos publicados ordenados por popularidad';

-- ============================================
-- VACUUM Y OPTIMIZACIÓN
-- ============================================

-- Ejecutar VACUUM ANALYZE para optimizar el rendimiento
-- (Esto se debe ejecutar periódicamente en producción)
VACUUM ANALYZE;
