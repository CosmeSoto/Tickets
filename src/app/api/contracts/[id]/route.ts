import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'
import { canManageInventory, canManageAsset, inventoryForbidden } from '@/lib/inventory-access'
import { updateContractSchema } from '@/lib/validations/contracts'
import { ZodError } from 'zod'

// GET /api/contracts/[id]
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params = await context.params

  const hasAccess =
    session.user.role === 'ADMIN' || (await canManageInventory(session.user.id, session.user.role))
  if (!hasAccess) return inventoryForbidden()

  const contract = await ContractService.getById(params.id)
  if (!contract) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  // Verificar acceso a la familia (excepto SuperAdmin)
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (!isSuperAdmin && contract.familyId) {
    const allowed = await canManageAsset(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      contract.familyId
    )
    if (!allowed) return inventoryForbidden()
  }

  return NextResponse.json(contract)
}

// PUT /api/contracts/[id]
export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params = await context.params

  if (!(await canManageInventory(session.user.id, session.user.role))) {
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
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        contract.familyId
      )
      if (!allowed) return inventoryForbidden()
    }
  }

  try {
    const raw = await req.json()
    // Si category llega vacía (deselección del Combobox) omitirla del update
    if (raw.category === '') delete raw.category

    const { lines: rawLines, ...rest } = raw
    const p = updateContractSchema.parse(rest)

    // Construir objeto sin nulls (el servicio espera undefined, no null)
    const updateData: Parameters<typeof ContractService.update>[1] = {}
    if (p.contractNumber !== undefined) updateData.contractNumber = p.contractNumber ?? undefined
    if (p.name !== undefined)           updateData.name = p.name
    if (p.description !== undefined)    updateData.description = p.description ?? undefined
    if (p.category !== undefined)       updateData.category = p.category
    if (p.supplierId !== undefined)     updateData.supplierId = p.supplierId ?? undefined
    if (p.familyId !== undefined)       updateData.familyId = p.familyId ?? undefined
    if (p.modelId !== undefined)        updateData.modelId = p.modelId ?? undefined
    if (p.batchId !== undefined)        updateData.batchId = p.batchId ?? undefined
    if (p.startDate !== undefined)      updateData.startDate = p.startDate ?? undefined
    if (p.endDate !== undefined)        updateData.endDate = p.endDate ?? undefined
    if (p.autoRenew !== undefined)      updateData.autoRenew = p.autoRenew
    if (p.renewalNoticeDays !== undefined) updateData.renewalNoticeDays = p.renewalNoticeDays
    if (p.billingCycle !== undefined)   updateData.billingCycle = p.billingCycle
    if (p.totalValue !== undefined)     updateData.totalValue = p.totalValue ?? undefined
    if (p.monthlyCost !== undefined)    updateData.monthlyCost = p.monthlyCost ?? undefined
    if (p.currency !== undefined)       updateData.currency = p.currency
    if (p.contactName !== undefined)    updateData.contactName = p.contactName ?? undefined
    if (p.contactEmail !== undefined)   updateData.contactEmail = p.contactEmail || undefined
    if (p.contactPhone !== undefined)   updateData.contactPhone = p.contactPhone ?? undefined
    if (p.notes !== undefined)          updateData.notes = p.notes ?? undefined
    if (p.termsUrl !== undefined)       updateData.termsUrl = p.termsUrl || undefined
    // status puede venir del cuerpo (ej. TERMINATED al cerrar contrato)
    if (raw.status !== undefined)       updateData.status = raw.status

    await ContractService.update(params.id, updateData, session.user.id)

    if (Array.isArray(rawLines)) {
      await ContractService.upsertLines(params.id, rawLines, session.user.id)
    }

    const updated = await ContractService.getById(params.id)
    return NextResponse.json(updated)
  } catch (err: any) {
    if (err instanceof ZodError) {
      const first = err.errors[0]
      return NextResponse.json(
        { error: first?.message ?? 'Datos inválidos', field: first?.path?.join('.'), details: err.errors },
        { status: 422 }
      )
    }
    console.error('[PUT /api/contracts/[id]]', err)
    return NextResponse.json({ error: err.message ?? 'Error al actualizar' }, { status: 500 })
  }
}

// DELETE /api/contracts/[id] — ADMIN (SuperAdmin o Admin de la familia)
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params = await context.params

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Solo administradores pueden eliminar contratos' },
      { status: 403 }
    )
  }

  // Admin normal: verificar que tenga acceso a la familia del contrato
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  if (!isSuperAdmin) {
    const contract = await ContractService.getById(params.id)
    if (contract?.familyId) {
      const allowed = await canManageAsset(
        session.user.id,
        session.user.role,
        isSuperAdmin,
        contract.familyId
      )
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
