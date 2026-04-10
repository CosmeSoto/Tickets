'use client'

import { useSession } from 'next-auth/react'

/**
 * Hook centralizado para permisos de inventario en el frontend.
 * Refleja exactamente la misma jerarquía que el backend:
 *
 *   SuperAdmin  → puede todo
 *   Admin       → puede gestionar activos (sus familias o todas si no tiene asignadas)
 *   Gestor      → puede gestionar activos de sus familias (canManageInventory=true)
 *   Técnico     → puede crear/editar (sin gestión de familias)
 *   Cliente     → solo lectura de sus equipos asignados
 */
export function useInventoryPermissions() {
  const { data: session } = useSession()

  const role = session?.user?.role ?? 'CLIENT'
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true

  const isAdmin = role === 'ADMIN'
  const isTechnician = role === 'TECHNICIAN'
  const isClient = role === 'CLIENT'

  // Puede crear activos nuevos
  const canCreate = isAdmin || isTechnician || canManageInventory

  // Puede editar activos (el backend verifica además que sea de su familia)
  const canEdit = isAdmin || isTechnician || canManageInventory

  // Puede retirar/dar de baja activos (el backend verifica además que sea de su familia)
  const canRetire = isAdmin || canManageInventory

  // Solo superadmin puede eliminar permanentemente
  const canPermanentDelete = isAdmin && isSuperAdmin

  // Puede asignar equipos a usuarios
  const canAssign = isAdmin || isTechnician || canManageInventory

  // Puede devolver equipos a bodega
  const canReturn = isAdmin || isTechnician || canManageInventory

  // Puede registrar mantenimientos (no solo solicitarlos)
  const canManageMaintenance = isAdmin || isTechnician || canManageInventory

  // Cliente puede solicitar mantenimiento de sus equipos asignados
  const canRequestMaintenance = isClient

  return {
    role,
    isSuperAdmin,
    canManageInventory,
    isAdmin,
    isTechnician,
    isClient,
    canCreate,
    canEdit,
    canRetire,
    canPermanentDelete,
    canAssign,
    canReturn,
    canManageMaintenance,
    canRequestMaintenance,
  }
}
