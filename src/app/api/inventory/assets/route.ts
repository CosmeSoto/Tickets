import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import { queryAssets } from '@/lib/inventory/assets-query'
import { createAsset } from '@/lib/inventory/assets-create'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const { getInventorySessionContext } = await import('@/lib/inventory/inventory-session')
  const userCanManageInventory = (await getInventorySessionContext(session.user)).canManageInventory

  const { searchParams } = req.nextUrl
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20', 10) || 20, 100)

  try {
    const result = await queryAssets({
      userId,
      role,
      isSuperAdmin,
      userCanManageInventory,
      familyIdParam: searchParams.get('familyId') ?? undefined,
      subtypeParam: searchParams.get('subtype') ?? undefined,
      searchQuery: searchParams.get('search')?.trim().toLowerCase() ?? '',
      personalOnly: searchParams.get('personalOnly') === 'true',
      statusFilter: searchParams.get('status') ?? '',
      conditionFilter: searchParams.get('condition') ?? '',
      batchFilter: searchParams.get('batchFilter') ?? '',
      page: Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
      pageSize,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[GET /api/inventory/assets]', error)
    return NextResponse.json({ error: 'Error al obtener activos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { role, id: userId } = session.user as { role: string; id: string }
  if (role !== 'ADMIN') {
    const allowed = await canManageInventory(userId, role)
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para gestionar el inventario' },
        { status: 403 }
      )
    }
  }

  const body = await req.json()
  console.log('[POST /api/inventory/assets] subtype:', body.subtype, 'familyId:', body.familyId)

  try {
    const result = await createAsset(body, userId)

    // Resultado de validación (tiene .error y .status)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ ...result.asset, subtype: result.subtype }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/inventory/assets]', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message || 'Error al crear el activo' }, { status: 500 })
  }
}
