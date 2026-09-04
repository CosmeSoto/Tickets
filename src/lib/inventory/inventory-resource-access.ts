/**
 * Acceso centralizado a recursos de inventario por ID (familia / gestión).
 * Complementa inventory-access.ts y family-access.ts.
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { canManageInventory, canManageAsset, isTechnicianOfFamily } from '@/lib/inventory-access'
import { checkFamilyAccess } from '@/lib/inventory/family-access'
import { hasAccessToEquipment, hasAccessToLicense } from '@/lib/middleware/family-filter'
import { UserRole } from '@prisma/client'

export type InventoryResourceKind =
  | 'EQUIPMENT'
  | 'LICENSE'
  | 'CONSUMABLE'
  | 'CONTRACT'
  | 'ASSIGNMENT'
  | 'MODEL'
  | 'BATCH'
  | 'WAREHOUSE'
  | 'SUPPLIER'
  | 'SALE'

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
    case 'MODEL': {
      const model = await prisma.equipment_models.findUnique({
        where: { id: resourceId },
        select: { type: { select: { familyId: true } } },
      })
      return model?.type?.familyId ?? null
    }
    case 'BATCH': {
      const batch = await prisma.equipment_batches.findUnique({
        where: { id: resourceId },
        select: { model: { select: { type: { select: { familyId: true } } } } },
      })
      return batch?.model?.type?.familyId ?? null
    }
    case 'WAREHOUSE': {
      const wh = await prisma.warehouses.findUnique({
        where: { id: resourceId },
        select: { familyId: true },
      })
      return wh?.familyId ?? null
    }
    case 'SUPPLIER': {
      const sup = await prisma.suppliers.findUnique({
        where: { id: resourceId },
        select: { familyId: true },
      })
      return sup?.familyId ?? null
    }
    case 'SALE': {
      const sale = await prisma.equipment_sales.findUnique({
        where: { id: resourceId },
        select: { equipment: { select: { type: { select: { familyId: true } } } } },
      })
      return sale?.equipment?.type?.familyId ?? null
    }
    default:
      return null
  }
}

/** Acceso a rutas parametrizadas por familyId (ej. /families/[familyId]) */
export async function assertInventoryFamilyRoute(
  user: InventoryAccessUser,
  familyId: string,
  mode: 'read' | 'manage'
): Promise<void> {
  const manages = await canManageInventory(user.id, user.role)
  if (user.role !== 'ADMIN' && !manages) {
    throw new InventoryAccessError('No tienes permiso para acceder al inventario', 403)
  }
  if (mode === 'read') {
    await assertInventoryReadByFamily(user, familyId)
  } else {
    await assertInventoryManageByFamily(user, familyId)
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
  // CLIENT con una licencia asignada a su cuenta (software_licenses.assignedToUser):
  // igual que con equipos, la asignación personal da acceso de lectura aunque el
  // cliente no tenga acceso general al área — sin esto, "Mis Activos" podía listar
  // la licencia pero el detalle devolvía 403.
  if (kind === 'LICENSE' && user.role === 'CLIENT') {
    const ok = await hasAccessToLicense(user.id, resourceId)
    if (!ok) throw new InventoryAccessError('No tienes acceso a esta licencia', 403)
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

/**
 * Familia de un tipo de catálogo (equipment_types / consumable_types / license_types).
 * Usado para validar la familia DESTINO cuando un update reasigna el typeId
 * de un recurso ya existente (no solo la familia actual del recurso).
 */
async function getCatalogTypeFamilyId(
  kind: 'EQUIPMENT' | 'CONSUMABLE' | 'LICENSE',
  typeId: string
): Promise<string | null> {
  if (kind === 'EQUIPMENT') {
    const t = await prisma.equipment_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    return t?.familyId ?? null
  }
  if (kind === 'CONSUMABLE') {
    const t = await prisma.consumable_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    return t?.familyId ?? null
  }
  const t = await prisma.license_types.findUnique({
    where: { id: typeId },
    select: { familyId: true },
  })
  return t?.familyId ?? null
}

/**
 * Verifica permiso de gestión en la familia del tipo DESTINO al reasignar el
 * typeId de un equipo/consumible/licencia ya existente. Complementa
 * assertInventoryResourceManage, que solo valida la familia actual del
 * recurso antes de aplicar el update — sin esto, un gestor con acceso a una
 * sola familia podría mover el recurso a otra familia que no gestiona
 * simplemente cambiando su typeId en el PUT, evitando el flujo dedicado de
 * transfer-family (que sí valida origen y destino).
 */
export async function assertResourceTypeChangeAllowed(
  user: InventoryAccessUser,
  kind: 'EQUIPMENT' | 'CONSUMABLE' | 'LICENSE',
  newTypeId: string
): Promise<void> {
  const familyId = await getCatalogTypeFamilyId(kind, newTypeId)
  await assertInventoryManageByFamily(user, familyId)
}

/** Contratos bajo /api/inventory/contracts */
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
  const hasModuleAccess = user.isSuperAdmin || (await canManageInventory(user.id, user.role))
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

/** Verifica acceso de lectura al tipo de equipo (familia del typeId). */
export async function assertEquipmentTypeRead(
  user: InventoryAccessUser,
  typeId: string
): Promise<void> {
  const equipmentType = await prisma.equipment_types.findUnique({
    where: { id: typeId },
    select: { familyId: true },
  })
  if (!equipmentType) {
    throw new InventoryAccessError('Tipo de equipo no encontrado', 404)
  }
  await assertInventoryReadByFamily(user, equipmentType.familyId)
}

/** Verifica permiso de gestión para una lista de equipos. */
export async function assertEquipmentIdsManage(
  user: InventoryAccessUser,
  equipmentIds: string[]
): Promise<void> {
  const equipment = await prisma.equipment.findMany({
    where: { id: { in: equipmentIds } },
    select: { id: true, type: { select: { familyId: true } } },
  })
  if (equipment.length !== equipmentIds.length) {
    throw new InventoryAccessError('Algunos equipos no fueron encontrados', 404)
  }
  for (const eq of equipment) {
    await assertInventoryManageByFamily(user, eq.type?.familyId ?? null)
  }
}

async function getMaintenanceEquipmentId(maintenanceId: string): Promise<string> {
  const record = await prisma.maintenance_records.findUnique({
    where: { id: maintenanceId },
    select: { equipmentId: true },
  })
  if (!record) {
    throw new InventoryAccessError('Mantenimiento no encontrado', 404)
  }
  return record.equipmentId
}

/** Lectura de un mantenimiento: cliente (asignado o solicitante) o staff con acceso al equipo. */
export async function assertMaintenanceRead(
  user: InventoryAccessUser,
  maintenanceId: string
): Promise<void> {
  const record = await prisma.maintenance_records.findUnique({
    where: { id: maintenanceId },
    select: { equipmentId: true, requestedById: true },
  })
  if (!record) {
    throw new InventoryAccessError('Mantenimiento no encontrado', 404)
  }

  if (user.role === 'CLIENT') {
    const isRequester = record.requestedById === user.id
    const hasEquipment = await hasAccessToEquipment(
      user.id,
      user.role as UserRole,
      user.isSuperAdmin,
      record.equipmentId
    )
    if (!isRequester && !hasEquipment) {
      throw new InventoryAccessError('No tienes acceso a este mantenimiento', 403)
    }
    return
  }

  await assertInventoryResourceRead(user, 'EQUIPMENT', record.equipmentId)
}

/** Gestión de mantenimiento: requiere permiso de gestión sobre el equipo. */
export async function assertMaintenanceManage(
  user: InventoryAccessUser,
  maintenanceId: string
): Promise<void> {
  const equipmentId = await getMaintenanceEquipmentId(maintenanceId)
  await assertInventoryResourceManage(user, 'EQUIPMENT', equipmentId)
}

/** Cliente acepta mantenimiento solo si tiene el equipo asignado. */
export async function assertMaintenanceClientAccept(
  user: InventoryAccessUser,
  maintenanceId: string
): Promise<void> {
  if (user.role !== 'CLIENT') {
    throw new InventoryAccessError('Solo el cliente puede aceptar el mantenimiento', 403)
  }
  const equipmentId = await getMaintenanceEquipmentId(maintenanceId)
  const hasEquipment = await hasAccessToEquipment(
    user.id,
    user.role as UserRole,
    user.isSuperAdmin,
    equipmentId
  )
  if (!hasEquipment) {
    throw new InventoryAccessError('No tienes acceso a este mantenimiento', 403)
  }
}

/**
 * Staff crea/programa mantenimiento: gestor con manage en familia,
 * técnico/admin con lectura en el equipo.
 */
export async function assertEquipmentMaintenanceWrite(
  user: InventoryAccessUser,
  equipmentId: string
): Promise<void> {
  if (user.role === 'CLIENT') {
    throw new InventoryAccessError('No tienes permisos para programar mantenimientos', 403)
  }

  const manages = await canManageInventory(user.id, user.role)
  if (manages) {
    await assertInventoryResourceManage(user, 'EQUIPMENT', equipmentId)
  } else {
    await assertInventoryResourceRead(user, 'EQUIPMENT', equipmentId)
  }
}

/** Acciones masivas: valida gestión sobre todos los equipos involucrados. */
export async function assertMaintenanceIdsManage(
  user: InventoryAccessUser,
  maintenanceIds: string[]
): Promise<void> {
  const records = await prisma.maintenance_records.findMany({
    where: { id: { in: maintenanceIds } },
    select: { id: true, equipmentId: true },
  })
  if (records.length !== maintenanceIds.length) {
    throw new InventoryAccessError('Algunos mantenimientos no fueron encontrados', 404)
  }
  const equipmentIds = [...new Set(records.map(r => r.equipmentId))]
  await assertEquipmentIdsManage(user, equipmentIds)
}
