-- ============================================
-- SEED: Políticas de SLA por Defecto
-- ============================================
-- Este script crea políticas de SLA profesionales para cada prioridad
-- Basado en mejores prácticas de la industria de soporte técnico

-- Limpiar políticas existentes (opcional, comentar si no quieres eliminar)
-- DELETE FROM ticket_sla_metrics;
-- DELETE FROM sla_violations;
-- DELETE FROM sla_policies;

-- ============================================
-- POLÍTICAS GLOBALES (Sin categoría específica)
-- ============================================

-- Política para tickets URGENT (Críticos)
-- Uso: Sistemas caídos, pérdida de servicio crítico, seguridad comprometida
INSERT INTO sla_policies (
  id,
  name,
  description,
  category_id,
  priority,
  response_time_hours,
  resolution_time_hours,
  business_hours_only,
  business_hours_start,
  business_hours_end,
  business_days,
  is_active,
  created_at,
  updated_at
) VALUES (
  UUID(),
  'SLA Urgente - 24/7',
  'Política de SLA para tickets de prioridad urgente. Respuesta inmediata y resolución en 4 horas. Aplica 24/7 incluyendo fines de semana.',
  NULL,  -- Aplica a todas las categorías
  'URGENT',
  1,     -- 1 hora de respuesta
  4,     -- 4 horas de resolución
  FALSE, -- 24/7, no solo horas laborales
  '00:00:00',
  '23:59:59',
  'MON,TUE,WED,THU,FRI,SAT,SUN',
  TRUE,
  NOW(),
  NOW()
);

-- Política para tickets HIGH (Alta prioridad)
-- Uso: Funcionalidad importante afectada, múltiples usuarios impactados
INSERT INTO sla_policies (
  id,
  name,
  description,
  category_id,
  priority,
  response_time_hours,
  resolution_time_hours,
  business_hours_only,
  business_hours_start,
  business_hours_end,
  business_days,
  is_active,
  created_at,
  updated_at
) VALUES (
  UUID(),
  'SLA Alta Prioridad',
  'Política de SLA para tickets de alta prioridad. Respuesta en 4 horas y resolución en 24 horas durante horario laboral.',
  NULL,
  'HIGH',
  4,     -- 4 horas de respuesta
  24,    -- 24 horas de resolución
  TRUE,  -- Solo horas laborales
  '09:00:00',
  '18:00:00',
  'MON,TUE,WED,THU,FRI',
  TRUE,
  NOW(),
  NOW()
);

-- Política para tickets MEDIUM (Prioridad media)
-- Uso: Problemas que afectan productividad pero tienen workaround
INSERT INTO sla_policies (
  id,
  name,
  description,
  category_id,
  priority,
  response_time_hours,
  resolution_time_hours,
  business_hours_only,
  business_hours_start,
  business_hours_end,
  business_days,
  is_active,
  created_at,
  updated_at
) VALUES (
  UUID(),
  'SLA Prioridad Media',
  'Política de SLA para tickets de prioridad media. Respuesta en 8 horas y resolución en 48 horas durante horario laboral.',
  NULL,
  'MEDIUM',
  8,     -- 8 horas de respuesta
  48,    -- 48 horas de resolución
  TRUE,  -- Solo horas laborales
  '09:00:00',
  '18:00:00',
  'MON,TUE,WED,THU,FRI',
  TRUE,
  NOW(),
  NOW()
);

-- Política para tickets LOW (Baja prioridad)
-- Uso: Consultas, mejoras, problemas menores sin impacto crítico
INSERT INTO sla_policies (
  id,
  name,
  description,
  category_id,
  priority,
  response_time_hours,
  resolution_time_hours,
  business_hours_only,
  business_hours_start,
  business_hours_end,
  business_days,
  is_active,
  created_at,
  updated_at
) VALUES (
  UUID(),
  'SLA Baja Prioridad',
  'Política de SLA para tickets de baja prioridad. Respuesta en 24 horas y resolución en 72 horas durante horario laboral.',
  NULL,
  'LOW',
  24,    -- 24 horas de respuesta
  72,    -- 72 horas de resolución
  TRUE,  -- Solo horas laborales
  '09:00:00',
  '18:00:00',
  'MON,TUE,WED,THU,FRI',
  TRUE,
  NOW(),
  NOW()
);

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que se crearon las políticas
SELECT 
  name,
  priority,
  response_time_hours,
  resolution_time_hours,
  business_hours_only,
  is_active
FROM sla_policies
WHERE is_active = TRUE
ORDER BY 
  CASE priority
    WHEN 'URGENT' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END;

-- Mostrar resumen
SELECT 
  'Políticas de SLA creadas exitosamente' as mensaje,
  COUNT(*) as total_politicas
FROM sla_policies
WHERE is_active = TRUE;
