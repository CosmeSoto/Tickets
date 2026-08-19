'use client'

import { useSession } from 'next-auth/react'

/**
 * Hook centralizado para permisos de inventario en el frontend.
 * Refleja la jerarquía del backend:
 *
 *   SuperAdmin              → puede todo
 *   Admin / Técnico + flag  → gestión completa
 *   Técnico sin gestión     → operativa limitada (API valida familia)
 *   Cliente                 → nunca gestor: lectura / solicitudes
 */
export function useInventoryPermissions() {
  const { data: session } = useSession()

  const role = session?.user?.role ?? 'CLIENT'
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true

  const isAdmin = role === 'ADMIN'
  const isTechnician = role === 'TECHNICIAN'
  const isClient = role === 'CLIENT'

  const canCreate = isSuperAdmin || canManageInventory || isTechnician
  const canEdit = isSuperAdmin || canManageInventory || isTechnician
  const canRetire = isSuperAdmin || canManageInventory
  const canPermanentDelete = isAdmin && isSuperAdmin
  const canAssign = isSuperAdmin || canManageInventory || isTechnician
  const canReturn = isSuperAdmin || canManageInventory || isTechnician
  const canManageMaintenance = isSuperAdmin || canManageInventory || isTechnician
  const canRequestMaintenance = isClient

  const canManageContracts = isSuperAdmin || canManageInventory
  const canViewOwnContracts = isClient || canManageContracts
  const canDeleteContracts = isSuperAdmin || (isAdmin && canManageInventory)

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
    canManageContracts,
    canViewOwnContracts,
    canDeleteContracts,
  }
}
