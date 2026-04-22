import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ContractService } from '@/lib/services/contract-service'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

// GET /api/contracts — listar contratos
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  // Lectura: ADMIN, gestores de inventario y técnicos pueden ver contratos
  const hasAccess = session.user.role === 'ADMIN'
    || await canManageInventory(session.user.id, session.user.role)
  if (!hasAccess) return inventoryForbidden()

  const { searchParams } = new URL(req.url)
  try {
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const result = await ContractService.list({
      page:         Number(searchParams.get('page')     ?? 1),
      pageSize:     Number(searchParams.get('pageSize') ?? 20),
      search:       searchParams.get('search')     ?? undefined,
      status:       searchParams.get('status')     ?? undefined,
      category:     searchParams.get('category')   ?? undefined,
      familyId:     searchParams.get('familyId')   ?? undefined,
      supplierId:   searchParams.get('supplierId') ?? undefined,
      userId:       session.user.id,
      userRole:     session.user.role,
      isSuperAdmin,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[GET /api/contracts]', err)
    return NextResponse.json({ error: 'Error al obtener contratos' }, { status: 500 })
  }
}

// POST /api/contracts — crear contrato
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return inventoryForbidden()
  }

  try {
    const body = await req.json()
    const contract = await ContractService.create({
      ...body,
      createdBy: session.user.id,
    })
    return NextResponse.json(contract, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/contracts]', err)
    return NextResponse.json({ error: err.message ?? 'Error al crear contrato' }, { status: 500 })
  }
}
