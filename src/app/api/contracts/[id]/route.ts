import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'
import { canManageInventory, canManageAsset, inventoryForbidden } from '@/lib/inventory-access'

type Params = { params: { id: string } }

// GET /api/contracts/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hasAccess = session.user.role === 'ADMIN'
    || await canManageInventory(session.user.id, session.user.role)
  if (!hasAccess) return inventoryForbidden()

  const contract = await ContractService.getById(params.id)
  if (!contract) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  // Verificar acceso a la familia (excepto SuperAdmin)
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (!isSuperAdmin && contract.familyId) {
    const allowed = await canManageAsset(session.user.id, session.user.role, isSuperAdmin, contract.familyId)
    if (!allowed) return inventoryForbidden()
  }

  return NextResponse.json(contract)
}

// PUT /api/contracts/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return inventoryForbidden()
  }

  // Verificar acceso a la familia del contrato
  // SuperAdmin → acceso total
  // Admin normal → solo sus familias asignadas (o todas si no tiene asignaciones)
  // Gestor → solo sus familias en inventory_manager_families
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (!isSuperAdmin) {
    const contract = await ContractService.getById(params.id)
    if (contract?.familyId) {
      const allowed = await canManageAsset(session.user.id, session.user.role, isSuperAdmin, contract.familyId)
      if (!allowed) return inventoryForbidden()
    }
  }

  try {
    const body = await req.json()
    const { lines, ...contractData } = body

    await ContractService.update(params.id, contractData, session.user.id)

    if (Array.isArray(lines)) {
      await ContractService.upsertLines(params.id, lines, session.user.id)
    }

    const updated = await ContractService.getById(params.id)
    return NextResponse.json(updated)
  } catch (err: any) {
    console.error('[PUT /api/contracts/[id]]', err)
    return NextResponse.json({ error: err.message ?? 'Error al actualizar' }, { status: 500 })
  }
}

// DELETE /api/contracts/[id] — ADMIN (SuperAdmin o Admin de la familia)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo administradores pueden eliminar contratos' }, { status: 403 })
  }

  // Admin normal: verificar que tenga acceso a la familia del contrato
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (!isSuperAdmin) {
    const contract = await ContractService.getById(params.id)
    if (contract?.familyId) {
      const allowed = await canManageAsset(session.user.id, session.user.role, isSuperAdmin, contract.familyId)
      if (!allowed) return inventoryForbidden()
    }
  }

  try {
    await ContractService.delete(params.id, session.user.id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[DELETE /api/contracts/[id]]', err)
    return NextResponse.json({ error: err.message ?? 'Error al eliminar' }, { status: 500 })
  }
}
