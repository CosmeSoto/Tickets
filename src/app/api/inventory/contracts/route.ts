import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { assertContractViewAccess } from '@/lib/contracts/access'
import { createContractSchema } from '@/lib/validations/contracts'
import { extractBillingPayload } from '@/lib/contracts/billing-payload'
import { ZodError } from 'zod'

// GET /api/inventory/contracts — listar contratos
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const hasAccess =
    session.user.role === 'ADMIN' ||
    session.user.role === 'CLIENT' ||
    (await canManageInventory(session.user.id, session.user.role))
  if (!hasAccess) return inventoryForbidden()

  const { searchParams } = new URL(req.url)
  try {
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const result = await ContractService.list({
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 20),
      search: searchParams.get('search') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      familyId: searchParams.get('familyId') ?? undefined,
      supplierId: searchParams.get('supplierId') ?? undefined,
      userId: session.user.id,
      userRole: session.user.role,
      isSuperAdmin,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/inventory/contracts]', err)
    return NextResponse.json({ error: 'Error al obtener contratos' }, { status: 500 })
  }
}

// POST /api/inventory/contracts — crear contrato
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return inventoryForbidden()
  }

  try {
    const raw = await req.json()
    if (!raw.category || raw.category === '') raw.category = 'SERVICE'

    const p = createContractSchema.parse(raw)

    const contract = await ContractService.create({
      contractNumber: p.contractNumber ?? undefined,
      name: p.name,
      description: p.description ?? undefined,
      category: p.category,
      supplierId: p.supplierId ?? undefined,
      familyId: p.familyId ?? undefined,
      modelId: p.modelId ?? undefined,
      batchId: p.batchId ?? undefined,
      startDate: p.startDate ?? undefined,
      endDate: p.endDate ?? undefined,
      autoRenew: p.autoRenew,
      renewalNoticeDays: p.renewalNoticeDays,
      billingCycle: p.billingCycle,
      totalValue: p.totalValue ?? undefined,
      monthlyCost: p.monthlyCost ?? undefined,
      currency: p.currency,
      contactName: p.contactName ?? undefined,
      contactEmail: p.contactEmail || undefined,
      contactPhone: p.contactPhone ?? undefined,
      notes: p.notes ?? undefined,
      termsUrl: p.termsUrl || undefined,
      ...extractBillingPayload(p),
      lines: p.lines.map(l => ({
        type: l.type,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice ?? undefined,
        equipmentId: l.equipmentId ?? undefined,
        licenseId: l.licenseId ?? undefined,
        notes: l.notes ?? undefined,
        order: l.order,
      })),
      createdBy: session.user.id,
    })
    return NextResponse.json(contract, { status: 201 })
  } catch (err: any) {
    if (err instanceof ZodError) {
      const first = err.errors[0]
      return NextResponse.json(
        {
          error: first?.message ?? 'Datos inválidos',
          field: first?.path?.join('.'),
          details: err.errors,
        },
        { status: 422 }
      )
    }
    console.error('[POST /api/inventory/contracts]', err)
    return NextResponse.json({ error: err.message ?? 'Error al crear contrato' }, { status: 500 })
  }
}
