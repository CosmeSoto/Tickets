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
  if (user.role === 'ADMIN') return true
  return canManageInventory(user.id, user.role)
}

/** Puede eliminar contratos (solo admin con scope) */
export function canDeleteContracts(user: ContractAccessUser): boolean {
  return user.role === 'ADMIN'
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

  if (user.role === 'ADMIN' || (await canManageInventory(user.id, user.role))) {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: { familyId: true },
    })
    if (!contract) throw new Error('Contrato no encontrado')
    const allowed = await canManageAsset(
      user.id,
      user.role,
      false,
      contract.familyId
    )
    if (!allowed) throw new Error('Sin permiso para esta familia')
    return
  }

  throw new Error('Sin permiso para ver contratos')
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
