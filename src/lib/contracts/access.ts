/**
 * Permisos del módulo de contratos / suscripciones por rol.
 */
import { prisma } from '@/lib/prisma'
import { canManageAsset, canManageInventory } from '@/lib/inventory-access'

export type ContractAccessUser = {
  id: string
  role: string
  isSuperAdmin?: boolean
}

/** Puede crear, editar, asignar clientes y generar actas */
export async function canManageContracts(user: ContractAccessUser): Promise<boolean> {
  if (user.isSuperAdmin) return true
  return canManageInventory(user.id, user.role)
}

/** Puede eliminar contratos (admin con gestión / super admin) */
export async function canDeleteContracts(user: ContractAccessUser): Promise<boolean> {
  if (user.isSuperAdmin) return true
  if (user.role !== 'ADMIN') return false
  return canManageInventory(user.id, user.role)
}

/** Cliente con alguna asignación al contrato */
export async function isContractClient(userId: string, contractId: string): Promise<boolean> {
  const row = await prisma.contract_assignments.findFirst({
    where: { contractId, clientId: userId },
    select: { id: true },
  })
  return !!row
}

/** Ver contrato: gestor/admin con familia, super admin todo, cliente si asignado */
export async function assertContractViewAccess(
  user: ContractAccessUser,
  contractId: string
): Promise<void> {
  if (user.isSuperAdmin) return

  if (user.role === 'CLIENT') {
    if (await isContractClient(user.id, contractId)) return
    throw new Error('No tienes acceso a este contrato')
  }

  if (!(await canManageInventory(user.id, user.role))) {
    throw new Error('Sin permiso para ver contratos')
  }

  const contract = await prisma.contracts.findUnique({
    where: { id: contractId },
    select: { familyId: true },
  })
  if (!contract) throw new Error('Contrato no encontrado')
  const allowed = await canManageAsset(user.id, user.role, false, contract.familyId)
  if (!allowed) throw new Error('Sin permiso para esta familia')
}

/** Operaciones de escritura sobre contrato en familia */
export async function assertContractWriteAccess(
  user: ContractAccessUser,
  contractId: string
): Promise<void> {
  if (!(await canManageContracts(user))) {
    throw new Error('Sin permiso para gestionar contratos')
  }
  await assertContractViewAccess(user, contractId)
}
