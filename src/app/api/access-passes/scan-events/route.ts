import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getAccessModulePermission } from '@/lib/access/access-control'

const VALID_RESULTS = [
  'VALID',
  'EXPIRED',
  'NOT_YET_VALID',
  'REVOKED',
  'SUSPENDED',
  'PENDING_PRIVACY',
  'INACTIVE_SUBJECT',
  'NOT_FOUND',
  'OUT_OF_SCOPE',
] as const

/**
 * GET /api/access-passes/scan-events
 *
 * Historial paginado de escaneos. Accesible para usuarios con canScan o canManage.
 *
 * Query params:
 *   page      – número de página (default 1)
 *   limit     – registros por página (default 20, max 100)
 *   familyId  – filtrar por área
 *   result    – filtrar por resultado (VALID, EXPIRED, …)
 *   dateFrom  – ISO date, inicio del rango
 *   dateTo    – ISO date, fin del rango (inclusive, se lleva al final del día)
 *   search    – busca en nombre/apellido de la persona
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const permission = await getAccessModulePermission(session.user.id, session.user.role)
  if (!permission.canScan && !permission.canManage) {
    return NextResponse.json({ error: 'No tienes acceso al módulo de Accesos.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)

  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '20')))
  const familyId = searchParams.get('familyId') || null
  const resultFilter = searchParams.get('result') || null
  const dateFrom = searchParams.get('dateFrom') || null
  const dateTo = searchParams.get('dateTo') || null
  const search = searchParams.get('search')?.trim() || null

  // Validar que el agente solo vea el scope de su familia
  if (familyId && permission.familyIds && !permission.familyIds.includes(familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esa área.' }, { status: 403 })
  }

  // Validar resultado
  if (resultFilter && !VALID_RESULTS.includes(resultFilter as (typeof VALID_RESULTS)[number])) {
    return NextResponse.json({ error: 'Resultado de filtro inválido.' }, { status: 400 })
  }

  // Construir el where de Prisma
  const where: Record<string, unknown> = {}

  // Scope de familia: los no-SuperAdmin solo ven sus áreas
  if (permission.familyIds !== undefined) {
    where.familyId = familyId ? familyId : { in: permission.familyIds }
  } else if (familyId) {
    where.familyId = familyId
  }

  if (resultFilter) {
    where.result = resultFilter
  }

  // Rango de fechas sobre scannedAt
  if (dateFrom || dateTo) {
    const range: Record<string, Date> = {}
    if (dateFrom) {
      const d = new Date(dateFrom)
      if (!Number.isNaN(d.getTime())) range.gte = d
    }
    if (dateTo) {
      const d = new Date(dateTo)
      if (!Number.isNaN(d.getTime())) {
        // Incluir todo el día final
        d.setHours(23, 59, 59, 999)
        range.lte = d
      }
    }
    if (Object.keys(range).length > 0) where.scannedAt = range
  }

  // Búsqueda por nombre/apellido de la persona del pase
  if (search) {
    where.pass = {
      subject: {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      },
    }
  }

  const db = prisma as any

  const [total, events] = await Promise.all([
    db.access_scan_events.count({ where }),
    db.access_scan_events.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        agent: { select: { id: true, name: true } },
        family: { select: { id: true, name: true, code: true } },
        pass: {
          select: {
            id: true,
            credentialCode: true,
            subject: {
              select: {
                firstName: true,
                lastName: true,
                accessType: true,
                organization: true,
              },
            },
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    events,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  })
}
