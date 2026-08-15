import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanManageAccess } from '@/lib/access/access-control'

function slugCode(name: string): string {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
    .slice(0, 50)
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied

  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
  const organizations = await (prisma as any).access_organizations.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(organizations)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  let code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
  if (!code) code = slugCode(name)
  if (!code) return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })

  const existing = await (prisma as any).access_organizations.findUnique({ where: { code } })
  if (existing) {
    return NextResponse.json({ error: 'Ya existe un arrendatario con ese código' }, { status: 409 })
  }

  const maxOrder = await (prisma as any).access_organizations.aggregate({ _max: { order: true } })
  const organization = await (prisma as any).access_organizations.create({
    data: {
      id: randomUUID(),
      code,
      name,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      order: (maxOrder._max.order ?? -1) + 1,
      updatedAt: new Date(),
    },
  })
  return NextResponse.json(organization, { status: 201 })
}
