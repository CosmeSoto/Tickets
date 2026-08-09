/**
 * Auth para /api/admin/inventory/* (configuración de catálogo).
 * ADMIN/super-admin: acceso total.
 * Gestores (canManageInventory): solo familias operativas.
 */

import { NextResponse } from 'next/server'
import { canManageInventory } from '@/lib/inventory-access'
import { getInventoryManageFamilyIds } from '@/lib/inventory/family-access'
import prisma from '@/lib/prisma'

export type AdminInventorySession = {
  userId: string
  role: string
  isSuperAdmin: boolean
  /** undefined = todas las familias (ADMIN/super-admin) */
  manageFamilyIds: string[] | undefined
}

export type AdminInventoryAuthResult =
  | { ok: true; auth: AdminInventorySession }
  | { ok: false; response: NextResponse }

/** Verifica sesión ADMIN o Super Admin (legacy, sin scope de gestor). */
export function isAdminInventorySession(
  session: { user?: { role?: string; isSuperAdmin?: boolean } | null } | null
): boolean {
  if (!session?.user) return false
  return session.user.role === 'ADMIN' || session.user.isSuperAdmin === true
}

export async function requireAdminInventoryAccess(
  session: {
    user?: {
      id?: string
      role?: string
      isSuperAdmin?: boolean
    } | null
  } | null
): Promise<AdminInventoryAuthResult> {
  if (!session?.user?.id || !session.user.role) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
    }
  }

  const userId = session.user.id
  const role = session.user.role
  const isSuperAdmin = session.user.isSuperAdmin === true

  if (isSuperAdmin) {
    return {
      ok: true,
      auth: { userId, role, isSuperAdmin, manageFamilyIds: undefined },
    }
  }

  const manages = await canManageInventory(userId, role)
  if (!manages) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
    }
  }

  // ADMIN de familia y gestores: scope operativo (no bypass total)
  const manageFamilyIds = await getInventoryManageFamilyIds(userId, role, isSuperAdmin, true)
  if (!manageFamilyIds || manageFamilyIds.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No tienes familias de inventario asignadas' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    auth: { userId, role, isSuperAdmin, manageFamilyIds },
  }
}

/** null = OK; NextResponse = denegado */
export function assertFamilyInManageScope(
  auth: AdminInventorySession,
  familyId: string | null | undefined
): NextResponse | null {
  if (auth.manageFamilyIds === undefined) return null
  if (!familyId) {
    return NextResponse.json(
      { error: 'Solo administradores pueden gestionar entradas globales del catálogo' },
      { status: 403 }
    )
  }
  if (!auth.manageFamilyIds.includes(familyId)) {
    return NextResponse.json({ error: 'Sin acceso a esta familia' }, { status: 403 })
  }
  return null
}

type FamilyScopedTable =
  | 'equipment_types'
  | 'license_types'
  | 'consumable_types'
  | 'equipment_brands'
  | 'warehouses'
  | 'supplier_types'

/** Valida que todos los ids pertenezcan a familias gestionables. */
export async function assertCatalogIdsInManageScope(
  auth: AdminInventorySession,
  table: FamilyScopedTable,
  ids: string[]
): Promise<NextResponse | null> {
  if (auth.manageFamilyIds === undefined) return null

  const rows = await (prisma as any)[table].findMany({
    where: { id: { in: ids } },
    select: { id: true, familyId: true },
  })

  if (rows.length !== ids.length) {
    return NextResponse.json({ error: 'Algunos elementos no existen' }, { status: 404 })
  }

  for (const row of rows) {
    const denied = assertFamilyInManageScope(auth, row.familyId)
    if (denied) return denied
  }
  return null
}
