-- ============================================
-- MIGRACIÓN: Asignar SLA a Tickets Existentes
-- ============================================
-- Este script asigna políticas de SLA a tickets que no tienen SLA asignado
-- ADVERTENCIA: Revisar y ajustar según necesidades antes de ejecutar

-- ============================================
-- PASO 1: Verificar estado actual
-- ============================================

-- Ver cuántos tickets NO tienen SLA asignado
SELECT 
  'Tickets sin SLA' as tipo,
  COUNT(*) as cantidad
FROM tickets t
WHERE t.id NOT IN (SELECT ticketId FROM ticket_sla_metrics);

-- Ver distribución por prioridad de tickets sin SLA
SELECT 
  t.priority,
  COUNT(*) as cantidad,
  MIN(t.created_at) as ticket_mas_antiguo,
  MAX(t.created_at) as ticket_mas_reciente
FROM tickets t
WHERE t.id NOT IN (SELECT ticketId FROM ticket_sla_metrics)
GROUP BY t.priority
ORDER BY 
  CASE t.priority
    WHEN 'URGENT' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END;

-- ============================================
-- PASO 2: Asignar SLA a tickets existentes
-- ============================================

-- OPCIÓN A: Asignar SLA solo a tickets de los últimos 90 días
-- (Recomendado para evitar procesar tickets muy antiguos)

INSERT INTO ticket_sla_metrics (
  id,
  ticket_id,
  sla_policy_id,
  response_deadline,
  resolution_deadline,
  first_response_at,
  resolved_at,
  response_sla_met,
  resolution_sla_met,
  response_time_minutes,
  resolution_time_minutes,
  created_at,
  updated_at
)
SELECT 
  UUID() as id,
  t.id as ticket_id,
  sp.id as sla_policy_id,
  
  -- Calcular response_deadline
  CASE 
    WHEN sp.business_hours_only = FALSE THEN
      DATE_ADD(t.created_at, INTERVAL sp.response_time_hours HOUR)
    ELSE
      -- Para horas laborales, usar cálculo simple (puede ajustarse)
      DATE_ADD(t.created_at, INTERVAL sp.response_time_hours HOUR)
  END as response_deadline,
  
  -- Calcular resolution_deadline
  CASE 
    WHEN sp.business_hours_only = FALSE THEN
      DATE_ADD(t.created_at, INTERVAL sp.resolution_time_hours HOUR)
    ELSE
      -- Para horas laborales, usar cálculo simple (puede ajustarse)
      DATE_ADD(t.created_at, INTERVAL sp.resolution_time_hours HOUR)
  END as resolution_deadline,
  
  -- first_response_at: usar la fecha del primer comentario del técnico
  (
    SELECT MIN(c.created_at)
    FROM comments c
    INNER JOIN users u ON c.user_id = u.id
    WHERE c.ticket_id = t.id 
      AND u.role IN ('TECHNICIAN', 'ADMIN')
      AND c.is_internal = FALSE
  ) as first_response_at,
  
  -- resolved_at: usar la fecha de resolución del ticket
  t.resolved_at as resolved_at,
  
  -- response_sla_met: verificar si la primera respuesta fue a tiempo
  CASE 
    WHEN (
      SELECT MIN(c.created_at)
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = t.id 
        AND u.role IN ('TECHNICIAN', 'ADMIN')
        AND c.is_internal = FALSE
    ) IS NOT NULL THEN
      CASE 
        WHEN (
          SELECT MIN(c.created_at)
          FROM comments c
          INNER JOIN users u ON c.user_id = u.id
          WHERE c.ticket_id = t.id 
            AND u.role IN ('TECHNICIAN', 'ADMIN')
            AND c.is_internal = FALSE
        ) <= DATE_ADD(t.created_at, INTERVAL sp.response_time_hours HOUR)
        THEN TRUE
        ELSE FALSE
      END
    ELSE NULL
  END as response_sla_met,
  
  -- resolution_sla_met: verificar si la resolución fue a tiempo
  CASE 
    WHEN t.resolved_at IS NOT NULL THEN
      CASE 
        WHEN t.resolved_at <= DATE_ADD(t.created_at, INTERVAL sp.resolution_time_hours HOUR)
        THEN TRUE
        ELSE FALSE
      END
    ELSE NULL
  END as resolution_sla_met,
  
  -- response_time_minutes: calcular tiempo de primera respuesta
  CASE 
    WHEN (
      SELECT MIN(c.created_at)
      FROM comments c
      INNER JOIN users u ON c.user_id = u.id
      WHERE c.ticket_id = t.id 
        AND u.role IN ('TECHNICIAN', 'ADMIN')
        AND c.is_internal = FALSE
    ) IS NOT NULL THEN
      TIMESTAMPDIFF(MINUTE, t.created_at, (
        SELECT MIN(c.created_at)
        FROM comments c
        INNER JOIN users u ON c.user_id = u.id
        WHERE c.ticket_id = t.id 
          AND u.role IN ('TECHNICIAN', 'ADMIN')
          AND c.is_internal = FALSE
      ))
    ELSE NULL
  END as response_time_minutes,
  
  -- resolution_time_minutes: calcular tiempo de resolución
  CASE 
    WHEN t.resolved_at IS NOT NULL THEN
      TIMESTAMPDIFF(MINUTE, t.created_at, t.resolved_at)
    ELSE NULL
  END as resolution_time_minutes,
  
  NOW() as created_at,
  NOW() as updated_at

FROM tickets t
INNER JOIN sla_policies sp ON t.priority = sp.priority 
  AND sp.is_active = TRUE 
  AND sp.category_id IS NULL  -- Solo políticas globales

WHERE t.id NOT IN (SELECT ticket_id FROM ticket_sla_metrics)
  AND t.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)  -- Solo últimos 90 días
  
ORDER BY t.created_at DESC;

-- ============================================
-- PASO 3: Crear violaciones para SLA incumplidos
-- ============================================

-- Crear violaciones de respuesta para tickets que no respondieron a tiempo
INSERT INTO sla_violations (
  id,
  ticket_id,
  sla_policy_id,
  violation_type,
  expected_at,
  actual_at,
  is_resolved,
  severity,
  created_at
)
SELECT 
  UUID() as id,
  tsm.ticket_id,
  tsm.sla_policy_id,
  'RESPONSE' as violation_type,
  tsm.response_deadline as expected_at,
  tsm.first_response_at as actual_at,
  TRUE as is_resolved,  -- Ya está resuelto porque ya respondieron
  
  -- Calcular severidad basada en el retraso
  CASE 
    WHEN TIMESTAMPDIFF(HOUR, tsm.response_deadline, tsm.first_response_at) > 24 THEN 'CRITICAL'
    WHEN TIMESTAMPDIFF(HOUR, tsm.response_deadline, tsm.first_response_at) > 8 THEN 'HIGH'
    WHEN TIMESTAMPDIFF(HOUR, tsm.response_deadline, tsm.first_response_at) > 2 THEN 'MEDIUM'
    ELSE 'LOW'
  END as severity,
  
  NOW() as created_at

FROM ticket_sla_metrics tsm
WHERE tsm.response_sla_met = FALSE
  AND tsm.first_response_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sla_violations sv 
    WHERE sv.ticket_id = tsm.ticket_id 
      AND sv.violation_type = 'RESPONSE'
  );

-- Crear violaciones de resolución para tickets que no resolvieron a tiempo
INSERT INTO sla_violations (
  id,
  ticket_id,
  sla_policy_id,
  violation_type,
  expected_at,
  actual_at,
  is_resolved,
  severity,
  created_at
)
SELECT 
  UUID() as id,
  tsm.ticket_id,
  tsm.sla_policy_id,
  'RESOLUTION' as violation_type,
  tsm.resolution_deadline as expected_at,
  tsm.resolved_at as actual_at,
  TRUE as is_resolved,  -- Ya está resuelto porque ya se resolvió el ticket
  
  -- Calcular severidad basada en el retraso
  CASE 
    WHEN TIMESTAMPDIFF(HOUR, tsm.resolution_deadline, tsm.resolved_at) > 24 THEN 'CRITICAL'
    WHEN TIMESTAMPDIFF(HOUR, tsm.resolution_deadline, tsm.resolved_at) > 8 THEN 'HIGH'
    WHEN TIMESTAMPDIFF(HOUR, tsm.resolution_deadline, tsm.resolved_at) > 2 THEN 'MEDIUM'
    ELSE 'LOW'
  END as severity,
  
  NOW() as created_at

FROM ticket_sla_metrics tsm
WHERE tsm.resolution_sla_met = FALSE
  AND tsm.resolved_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sla_violations sv 
    WHERE sv.ticket_id = tsm.ticket_id 
      AND sv.violation_type = 'RESOLUTION'
  );

-- ============================================
-- PASO 4: Actualizar campo slaDeadline en tickets
-- ============================================

UPDATE tickets t
INNER JOIN ticket_sla_metrics tsm ON t.id = tsm.ticket_id
SET t.sla_deadline = tsm.resolution_deadline
WHERE t.sla_deadline IS NULL;

-- ============================================
-- PASO 5: Verificar resultados
-- ============================================

-- Ver resumen de tickets con SLA asignado
SELECT 
  'Tickets con SLA asignado' as tipo,
  COUNT(*) as cantidad
FROM ticket_sla_metrics;

-- Ver cumplimiento de SLA por prioridad
SELECT 
  t.priority,
  COUNT(*) as total_tickets,
  SUM(CASE WHEN tsm.response_sla_met = TRUE THEN 1 ELSE 0 END) as respuesta_cumplida,
  SUM(CASE WHEN tsm.resolution_sla_met = TRUE THEN 1 ELSE 0 END) as resolucion_cumplida,
  ROUND(AVG(CASE WHEN tsm.response_sla_met = TRUE THEN 100 ELSE 0 END), 1) as tasa_cumplimiento_respuesta,
  ROUND(AVG(CASE WHEN tsm.resolution_sla_met = TRUE THEN 100 ELSE 0 END), 1) as tasa_cumplimiento_resolucion
FROM tickets t
INNER JOIN ticket_sla_metrics tsm ON t.id = tsm.ticket_id
WHERE tsm.first_response_at IS NOT NULL OR tsm.resolved_at IS NOT NULL
GROUP BY t.priority
ORDER BY 
  CASE t.priority
    WHEN 'URGENT' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END;

-- Ver violaciones creadas
SELECT 
  violation_type,
  severity,
  COUNT(*) as cantidad
FROM sla_violations
GROUP BY violation_type, severity
ORDER BY 
  violation_type,
  CASE severity
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
    WHEN 'MEDIUM' THEN 3
    WHEN 'LOW' THEN 4
  END;

-- Mostrar resumen final
SELECT 
  'Migración completada exitosamente' as mensaje,
  (SELECT COUNT(*) FROM ticket_sla_metrics) as tickets_con_sla,
  (SELECT COUNT(*) FROM sla_violations) as violaciones_registradas,
  (SELECT COUNT(*) FROM tickets WHERE sla_deadline IS NOT NULL) as tickets_con_deadline;
