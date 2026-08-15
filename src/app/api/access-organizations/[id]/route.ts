import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanManageAccess } from '@/lib/access/access-control'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied

  const id = (await params).id
  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

  const existing = await (prisma as any).access_organizations.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const organization = await (prisma as any).access_organizations.update({
    where: { id },
    data: {
      name,
      description:
        typeof body.description === 'string'
          ? body.description.trim() || null
          : existing.description,
      updatedAt: new Date(),
    },
  })
  return NextResponse.json(organization)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id, session.user.role)
  if (denied) return denied

  const id = (await params).id
  const existing = await (prisma as any).access_organizations.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const inUse = await (prisma as any).access_subjects.count({ where: { organizationId: id } })
  if (inUse > 0) {
    await (prisma as any).access_organizations.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    })
    return NextResponse.json({ success: true, deactivated: true })
  }

  await (prisma as any).access_organizations.delete({ where: { id } })
  return NextResponse.json({ success: true, deleted: true })
}
