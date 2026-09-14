import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAccessFamilyAllowed, requireAccessPermission } from '@/lib/access/access-control'
import { ACCESS_SCAN_RESULTS, ACCESS_SUBJECT_TYPES } from '@/lib/access/access-pass-state'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  familyId: z.string().uuid().optional(),
  result: z.enum(ACCESS_SCAN_RESULTS).optional(),
  accessType: z.enum(ACCESS_SUBJECT_TYPES).optional(),
  organizationId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().trim().min(1).max(200).optional(),
})

/**
 * GET /api/access-passes/scan-events
 *
 * Historial paginado de escaneos. Accesible para usuarios con canScan o canManage.
 *
 * Query params:
 *   page           – número de página (default 1)
 *   limit          – registros por página (default 20, max 100)
 *   familyId       – filtrar por área
 *   result         – filtrar por resultado (VALID, EXPIRED, …)
 *   accessType     – filtrar por tipo de acceso (TENANT_EMPLOYEE, CONTRACTOR, AUTHORIZED_VISITOR)
 *   organizationId – filtrar por arrendatario/empresa
 *   dateFrom       – ISO date, inicio del rango
 *   dateTo         – ISO date, fin del rango (inclusive, se lleva al final del día)
 *   search         – busca en código de credencial, nombre/apellido y arrendatario de la persona
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // canScan ya incluye canManage (ver getAccessModulePermission) — mismo
  // criterio que el resto de las rutas de accesos, en vez de reimplementarlo
  // inline como antes.
  const { denied, permission } = await requireAccessPermission(session.user.id, 'scan')
  if (denied) return denied

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Filtros inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const {
    page,
    limit,
    familyId,
    result: resultFilter,
    accessType: accessTypeFilter,
    organizationId,
    dateFrom,
    dateTo,
    search,
  } = parsed.data

  // Validar que el agente solo vea el scope de su familia
  if (familyId && !isAccessFamilyAllowed(permission, familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esa área.' }, { status: 403 })
  }

  // Construir el where de Prisma. Cada filtro se agrega como una entrada
  // separada de un AND explícito — así el filtro de tipo de acceso/arrendatario
  // (que también apunta a `pass.subject`) nunca puede quedar implícitamente
  // mezclado con las ramas de `search` (que también filtran sobre `pass`).
  const and: Record<string, unknown>[] = []

  // Scope de familia: los no-SuperAdmin solo ven sus áreas
  if (permission.familyIds !== undefined) {
    and.push({ familyId: familyId ? familyId : { in: permission.familyIds } })
  } else if (familyId) {
    and.push({ familyId })
  }

  if (resultFilter) and.push({ result: resultFilter })

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
    if (Object.keys(range).length > 0) and.push({ scannedAt: range })
  }

  // Tipo de acceso / arrendatario: filtran sobre el sujeto del pase escaneado
  const passSubjectWhere: Record<string, unknown> = {}
  if (accessTypeFilter) passSubjectWhere.accessType = accessTypeFilter
  if (organizationId) passSubjectWhere.organizationId = organizationId
  if (Object.keys(passSubjectWhere).length > 0) {
    and.push({ pass: { subject: passSubjectWhere } })
  }

  // Búsqueda por código de credencial, nombre/apellido o arrendatario de la persona
  if (search) {
    and.push({
      OR: [
        { pass: { credentialCode: { contains: search, mode: 'insensitive' } } },
        { pass: { subject: { firstName: { contains: search, mode: 'insensitive' } } } },
        { pass: { subject: { lastName: { contains: search, mode: 'insensitive' } } } },
        { pass: { subject: { organization: { contains: search, mode: 'insensitive' } } } },
      ],
    })
  }

  const where: Record<string, unknown> = and.length > 0 ? { AND: and } : {}

  const db = prisma

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
