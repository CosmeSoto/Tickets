/**
 * Acceso centralizado a recursos de inventario por ID (familia / gestión).
 * Complementa inventory-access.ts y family-access.ts.
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { canManageInventory, canManageAsset, isTechnicianOfFamily } from '@/lib/inventory-access'
import { checkFamilyAccess } from '@/lib/inventory/family-access'
import { hasAccessToEquipment } from '@/lib/middleware/family-filter'
import { UserRole } from '@prisma/client'

export type InventoryResourceKind =
  | 'EQUIPMENT'
  | 'LICENSE'
  | 'CONSUMABLE'
  | 'CONTRACT'
  | 'ASSIGNMENT'

export interface InventoryAccessUser {
  id: string
  role: string
  isSuperAdmin: boolean
}

export class InventoryAccessError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 403
  ) {
    super(message)
    this.name = 'InventoryAccessError'
  }
}

export function toInventoryAccessUser(sessionUser: {
  id: string
  role: string
  isSuperAdmin?: boolean
}): InventoryAccessUser {
  return {
    id: sessionUser.id,
    role: sessionUser.role,
    isSuperAdmin: sessionUser.isSuperAdmin === true,
  }
}

export async function getResourceFamilyId(
  kind: InventoryResourceKind,
  resourceId: string
): Promise<string | null> {
  switch (kind) {
    case 'EQUIPMENT': {
      const eq = await prisma.equipment.findUnique({
        where: { id: resourceId },
        select: { type: { select: { familyId: true } } },
      })
      return eq?.type?.familyId ?? null
    }
    case 'LICENSE': {
      const lic = await prisma.software_licenses.findUnique({
        where: { id: resourceId },
        select: { licenseType: { select: { familyId: true } } },
      })
      return lic?.licenseType?.familyId ?? null
    }
    case 'CONSUMABLE': {
      const c = await prisma.consumables.findUnique({
        where: { id: resourceId },
        select: { consumableType: { select: { familyId: true } } },
      })
      return c?.consumableType?.familyId ?? null
    }
    case 'CONTRACT': {
      const contract = await prisma.contracts.findUnique({
        where: { id: resourceId },
        select: { familyId: true },
      })
      return contract?.familyId ?? null
    }
    case 'ASSIGNMENT': {
      const a = await prisma.equipment_assignments.findUnique({
        where: { id: resourceId },
        select: { equipment: { select: { type: { select: { familyId: true } } } } },
      })
      return a?.equipment?.type?.familyId ?? null
    }
    default:
      return null
  }
}

/**
 * Lectura de activos por familia: super admin, admin/gestor en scope, técnico de la familia.
 */
export async function assertInventoryReadByFamily(
  user: InventoryAccessUser,
  familyId: string | null | undefined
): Promise<void> {
  if (user.isSuperAdmin) return

  if (!familyId) {
    throw new InventoryAccessError('Recurso sin familia asignada', 404)
  }

  const managesInventory = await canManageInventory(user.id, user.role)

  if (user.role === 'ADMIN' || managesInventory) {
    const ok = await checkFamilyAccess(
      user.id,
      familyId,
      user.role,
      user.isSuperAdmin,
      managesInventory
    )
    if (!ok) {
      throw new InventoryAccessError('No tienes acceso a recursos de esta familia', 403)
    }
    return
  }

  if (user.role === 'TECHNICIAN') {
    if (await isTechnicianOfFamily(user.id, familyId)) return
    throw new InventoryAccessError('No tienes acceso a recursos de esta familia', 403)
  }

  throw new InventoryAccessError('No tienes permisos para ver este recurso', 403)
}

/**
 * Escritura: requiere canManageInventory global + canManageAsset en la familia del activo.
 */
export async function assertInventoryManageByFamily(
  user: InventoryAccessUser,
  familyId: string | null | undefined
): Promise<void> {
  if (!(await canManageInventory(user.id, user.role))) {
    throw new InventoryAccessError('No tienes permisos de gestión de inventario', 403)
  }

  if (user.isSuperAdmin) return

  if (!familyId) {
    throw new InventoryAccessError('No se puede gestionar un recurso sin familia', 422)
  }

  const allowed = await canManageAsset(user.id, user.role, user.isSuperAdmin, familyId)
  if (!allowed) {
    throw new InventoryAccessError(
      'No tienes permisos para gestionar recursos de esta familia',
      403
    )
  }
}

export async function assertInventoryResourceRead(
  user: InventoryAccessUser,
  kind: InventoryResourceKind,
  resourceId: string
): Promise<string | null> {
  const familyId = await getResourceFamilyId(kind, resourceId)
  if (kind === 'EQUIPMENT') {
    const ok = await hasAccessToEquipment(
      user.id,
      user.role as UserRole,
      user.isSuperAdmin,
      resourceId
    )
    if (!ok) throw new InventoryAccessError('No tienes acceso a este equipo', 403)
    return familyId
  }
  await assertInventoryReadByFamily(user, familyId)
  return familyId
}

export async function assertInventoryResourceManage(
  user: InventoryAccessUser,
  kind: InventoryResourceKind,
  resourceId: string
): Promise<string | null> {
  const familyId = await getResourceFamilyId(kind, resourceId)
  await assertInventoryManageByFamily(user, familyId)
  return familyId
}

/** Contratos bajo /api/inventory/contracts — mismo criterio que /api/contracts/[id] */
export async function assertContractPaymentAccess(
  user: InventoryAccessUser,
  paymentId: string,
  mode: 'read' | 'write'
): Promise<void> {
  const payment = await prisma.contract_payments.findUnique({
    where: { id: paymentId },
    select: { contractId: true },
  })
  if (!payment) {
    throw new InventoryAccessError('Pago no encontrado', 404)
  }
  await assertContractAccess(user, payment.contractId, mode)
}

export async function assertContractAccess(
  user: InventoryAccessUser,
  contractId: string,
  mode: 'read' | 'write'
): Promise<void> {
  const hasModuleAccess = user.role === 'ADMIN' || (await canManageInventory(user.id, user.role))
  if (!hasModuleAccess) {
    throw new InventoryAccessError('No tienes permisos de gestión de inventario', 403)
  }

  if (user.isSuperAdmin) return

  const familyId = await getResourceFamilyId('CONTRACT', contractId)
  if (!familyId) return

  if (mode === 'read' || mode === 'write') {
    const allowed = await canManageAsset(user.id, user.role, user.isSuperAdmin, familyId)
    if (!allowed) {
      throw new InventoryAccessError('No tienes acceso a contratos de esta familia', 403)
    }
  }
}

export function inventoryAccessToResponse(err: InventoryAccessError) {
  return NextResponse.json({ error: err.message }, { status: err.statusCode })
}
