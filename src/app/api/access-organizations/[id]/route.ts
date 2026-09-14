import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAccessOrganizationInScope, requireAccessPermission } from '@/lib/access/access-control'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(500).optional().nullable(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { denied, permission } = await requireAccessPermission(session.user.id, 'manage')
  if (denied) return denied

  const id = (await params).id
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de arrendatario inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const existing = await prisma.access_organizations.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // access_organizations es un catálogo global (sin familyId): un gestor de
  // una sola área no puede renombrar/desactivar algo que otras áreas usan.
  if (!(await isAccessOrganizationInScope(permission, id))) {
    return NextResponse.json(
      { error: 'Esta empresa se usa en áreas fuera de tu alcance.' },
      { status: 403 }
    )
  }

  const data = parsed.data
  const nameChanged = data.name !== existing.name
  // El rename se propaga a la copia denormalizada en access_subjects.organization
  // en la misma transacción — si no, la tabla/exportación/correos y la
  // búsqueda por arrendatario quedan con el nombre viejo indefinidamente.
  const [organization] = await prisma.$transaction([
    prisma.access_organizations.update({
      where: { id },
      data: {
        name: data.name,
        description:
          data.description !== undefined ? data.description || null : existing.description,
        updatedAt: new Date(),
      },
    }),
    ...(nameChanged
      ? [
          prisma.access_subjects.updateMany({
            where: { organizationId: id },
            data: { organization: data.name },
          }),
        ]
      : []),
  ])

  await AuditServiceComplete.log({
    action: AuditActionsComplete.ACCESS_ORGANIZATION_UPDATED,
    entityType: 'access_organization',
    entityId: id,
    userId: session.user.id,
    oldValues: { name: existing.name, description: existing.description },
    newValues: { name: organization.name, description: organization.description },
    details: { source: 'access_module', subjectsRenamed: nameChanged },
    request,
  })
  return NextResponse.json(organization)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { denied, permission } = await requireAccessPermission(session.user.id, 'manage')
  if (denied) return denied

  const id = (await params).id
  const existing = await prisma.access_organizations.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (!(await isAccessOrganizationInScope(permission, id))) {
    return NextResponse.json(
      { error: 'Esta empresa se usa en áreas fuera de tu alcance.' },
      { status: 403 }
    )
  }

  const inUse = await prisma.access_subjects.count({ where: { organizationId: id } })
  if (inUse > 0) {
    await prisma.access_organizations.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    })
    await AuditServiceComplete.log({
      action: AuditActionsComplete.ACCESS_ORGANIZATION_DEACTIVATED,
      entityType: 'access_organization',
      entityId: id,
      userId: session.user.id,
      details: { source: 'access_module', reason: 'in_use', subjectsCount: inUse },
      request,
    })
    return NextResponse.json({ success: true, deactivated: true })
  }

  await prisma.access_organizations.delete({ where: { id } })
  await AuditServiceComplete.log({
    action: AuditActionsComplete.ACCESS_ORGANIZATION_DELETED,
    entityType: 'access_organization',
    entityId: id,
    userId: session.user.id,
    details: { source: 'access_module', code: existing.code, name: existing.name },
    request,
  })
  return NextResponse.json({ success: true, deleted: true })
}
