import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertCanManageAccess } from '@/lib/access/access-control'
import { isPrismaUniqueViolation } from '@/lib/access/access-errors'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_]{2,50}$/)
    .optional(),
  description: z.string().trim().max(500).optional().nullable(),
})

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
  const denied = await assertCanManageAccess(session.user.id)
  if (denied) return denied

  const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true'
  const organizations = await prisma.access_organizations.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
  return NextResponse.json(organizations)
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageAccess(session.user.id)
  if (denied) return denied

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de arrendatario inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data
  const code = data.code || slugCode(data.name)
  if (!code) return NextResponse.json({ error: 'El código es obligatorio' }, { status: 400 })

  try {
    const maxOrder = await prisma.access_organizations.aggregate({ _max: { order: true } })
    const organization = await prisma.access_organizations.create({
      data: {
        id: randomUUID(),
        code,
        name: data.name,
        description: data.description || null,
        order: (maxOrder._max.order ?? -1) + 1,
        updatedAt: new Date(),
      },
    })
    await AuditServiceComplete.log({
      action: AuditActionsComplete.ACCESS_ORGANIZATION_CREATED,
      entityType: 'access_organization',
      entityId: organization.id,
      userId: session.user.id,
      newValues: { code: organization.code, name: organization.name },
      details: { source: 'access_module' },
      request,
    })
    return NextResponse.json(organization, { status: 201 })
  } catch (error) {
    // Carrera de dos altas con el mismo código: el `findUnique` previo que
    // había acá antes de este fix también era una carrera (TOCTOU), y dejaba
    // pasar un P2002 sin manejar → 500 genérico en vez de un 409 claro.
    if (isPrismaUniqueViolation(error, 'code')) {
      return NextResponse.json(
        { error: 'Ya existe un arrendatario con ese código' },
        { status: 409 }
      )
    }
    throw error
  }
}
