import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { canManageInventory } from '@/lib/inventory-access'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const familyId = request.nextUrl.searchParams.get('familyId') ?? undefined
  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
  const isAdmin = session.user.role === 'ADMIN'

  const types = await (prisma as any).supplier_types.findMany({
    where: {
      ...(isAdmin && includeInactive ? {} : { isActive: true }),
      // Mostrar tipos globales (sin familia) + los de la familia solicitada
      ...(familyId ? { OR: [{ familyId: null }, { familyId }] } : {}),
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(types)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!await canManageInventory(session.user.id, session.user.role)) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const { code, name, description, familyId, order } = await request.json()
  if (!code || !name) return NextResponse.json({ error: 'Código y nombre son obligatorios' }, { status: 400 })

  const existing = await (prisma as any).supplier_types.findUnique({ where: { code: code.toUpperCase() } })
  if (existing) return NextResponse.json({ error: 'Ya existe un tipo con ese código' }, { status: 409 })

  const type = await (prisma as any).supplier_types.create({
    data: { id: randomUUID(), code: code.toUpperCase(), name, description: description || null, familyId: familyId || null, order: order ?? 999 },
  })
  return NextResponse.json(type, { status: 201 })
}
