-- ============================================
-- SEED: Políticas de SLA por Defecto (PostgreSQL)
-- ============================================

-- Verificar estado actual
SELECT 
  'Políticas existentes' as tipo,
  COUNT(*) as cantidad
FROM sla_policies
WHERE is_active = TRUE;

-- ============================================
-- POLÍTICAS GLOBALES
-- ============================================

-- Política para tickets URGENT (Críticos)
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
  gen_random_uuid(),
  'SLA Urgente - 24/7',
  'Política de SLA para tickets de prioridad urgente. Respuesta inmediata y resolución en 4 horas. Aplica 24/7 incluyendo fines de semana.',
  NULL,
  'URGENT',
  1,
  4,
  FALSE,
  '00:00:00',
  '23:59:59',
  'MON,TUE,WED,THU,FRI,SAT,SUN',
  TRUE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Política para tickets HIGH
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
  gen_random_uuid(),
  'SLA Alta Prioridad',
  'Política de SLA para tickets de alta prioridad. Respuesta en 4 horas y resolución en 24 horas durante horario laboral.',
  NULL,
  'HIGH',
  4,
  24,
  TRUE,
  '09:00:00',
  '18:00:00',
  'MON,TUE,WED,THU,FRI',
  TRUE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Política para tickets MEDIUM
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
  gen_random_uuid(),
  'SLA Prioridad Media',
  'Política de SLA para tickets de prioridad media. Respuesta en 8 horas y resolución en 48 horas durante horario laboral.',
  NULL,
  'MEDIUM',
  8,
  48,
  TRUE,
  '09:00:00',
  '18:00:00',
  'MON,TUE,WED,THU,FRI',
  TRUE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Política para tickets LOW
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
  gen_random_uuid(),
  'SLA Baja Prioridad',
  'Política de SLA para tickets de baja prioridad. Respuesta en 24 horas y resolución en 72 horas durante horario laboral.',
  NULL,
  'LOW',
  24,
  72,
  TRUE,
  '09:00:00',
  '18:00:00',
  'MON,TUE,WED,THU,FRI',
  TRUE,
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Verificar políticas creadas
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
