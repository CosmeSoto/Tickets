/**
 * Lógica centralizada de visibilidad de campos según estado del equipo.
 *
 * Regla de negocio:
 *   AVAILABLE  → bodega + departamento manual
 *   ASSIGNED   → usuario (auto-rellena departamento) — sin bodega
 *   MAINTENANCE→ departamento manual + bloque de mantenimiento — sin bodega
 *   DAMAGED    → bodega + departamento manual
 *   RETIRED    → aviso histórico — sin bodega, sin departamento
 *   SOLD       → igual que RETIRED
 */

export type EquipmentStatusValue =
  | 'AVAILABLE'
  | 'ASSIGNED'
  | 'MAINTENANCE'
  | 'DAMAGED'
  | 'RETIRED'
  | 'SOLD'

/** Muestra selector de departamento manual */
export function showDepartmentSelector(status: string): boolean {
  return ['AVAILABLE', 'MAINTENANCE', 'DAMAGED'].includes(status)
}

/** Muestra selector de bodega */
export function showWarehouseSelector(status: string): boolean {
  return ['AVAILABLE', 'DAMAGED'].includes(status)
}

/** Muestra bloque de asignación de usuario */
export function showAssignmentBlock(status: string): boolean {
  return status === 'ASSIGNED'
}

/** Muestra bloque de datos de mantenimiento */
export function showMaintenanceBlock(status: string): boolean {
  return status === 'MAINTENANCE'
}

/** Muestra aviso de activo histórico retirado */
export function showRetiredWarning(status: string): boolean {
  return status === 'RETIRED'
}

/** Muestra aviso de activo vendido */
export function showSoldWarning(status: string): boolean {
  return status === 'SOLD'
}
