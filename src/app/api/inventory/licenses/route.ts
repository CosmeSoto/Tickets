import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { licenseFiltersSchema } from '@/lib/validations/inventory/license'
import { ZodError } from 'zod'
import prisma from '@/lib/prisma'
import { getRenewalAlertStatus } from '@/lib/inventory/renewal-alert'
import { withCache, buildCacheKey, getSetting } from '@/lib/api-cache'
import { resolveInventoryListScope } from '@/lib/inventory/inventory-session'

/**
 * GET /api/inventory/licenses
 * Lista licencias con filtros y paginación
 *
 * Nota: este archivo solo expone GET — la creación de licencias pasa por
 * POST /api/inventory/assets con subtype LICENSE (ver assets-create.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filters = {
      search: searchParams.get('search') || undefined,
      typeId: searchParams.getAll('typeId').length > 0 ? searchParams.getAll('typeId') : undefined,
      assigned: searchParams.get('assigned') || undefined,
      expired: searchParams.get('expired') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
    }

    const supplierId = searchParams.get('supplierId') || undefined
    const orderByParam = searchParams.get('orderBy') || undefined
    const familyId = searchParams.get('familyId') || undefined
    const contractType = searchParams.get('contractType') || undefined
    const licenseScope = searchParams.get('licenseScope') || undefined

    const validatedFilters = licenseFiltersSchema.parse(filters)

    // Build where clause manually to support supplierId filter
    const where: any = {}
    if (validatedFilters.search) {
      where.OR = [
        { name: { contains: validatedFilters.search, mode: 'insensitive' } },
        { vendor: { contains: validatedFilters.search, mode: 'insensitive' } },
        { supplier: { name: { contains: validatedFilters.search, mode: 'insensitive' } } },
        { notes: { contains: validatedFilters.search, mode: 'insensitive' } },
      ]
    }

    if (validatedFilters.typeId && validatedFilters.typeId.length > 0) {
      where.typeId = { in: validatedFilters.typeId }
    }

    if (supplierId) {
      where.supplierId = supplierId
    }

    if (familyId) {
      where.licenseType = { familyId }
    } else {
      const scopeResult = await resolveInventoryListScope(session.user)
      if (scopeResult.noAccess) {
        return NextResponse.json({ licenses: [], total: 0, page: 1, limit: 10 })
      }
      if (scopeResult.scopeFamilyIds?.length) {
        where.licenseType = { familyId: { in: scopeResult.scopeFamilyIds } }
      }
    }

    if (contractType) {
      where.contractType = contractType
    }

    if (licenseScope) {
      where.licenseScope = licenseScope
    }

    if (validatedFilters.assigned === 'assigned') {
      where.OR = [
        { assignedToEquipment: { not: null } },
        { assignedToUser: { not: null } },
        { assignedToDepartment: { not: null } },
      ]
    } else if (validatedFilters.assigned === 'unassigned') {
      where.assignedToEquipment = null
      where.assignedToUser = null
      where.assignedToDepartment = null
    }

    const now = new Date()
    if (validatedFilters.expired === 'expired') {
      where.expirationDate = { lt: now }
    } else if (validatedFilters.expired === 'active') {
      where.OR = [{ expirationDate: null }, { expirationDate: { gte: now } }]
    } else if (validatedFilters.expired === 'expiring') {
      const alertDaysRaw = await getSetting('inventory.license_alert_days_first', 600, '30')
      const alertDays = Math.max(1, parseInt(alertDaysRaw ?? '30', 10) || 30)
      const windowEnd = new Date()
      windowEnd.setDate(windowEnd.getDate() + alertDays)
      where.expirationDate = { gte: now, lte: windowEnd }
    }

    const page = validatedFilters.page || 1
    const limit = validatedFilters.limit || 10

    const orderBy =
      orderByParam === 'renewalDate'
        ? { renewalDate: 'asc' as const }
        : { createdAt: 'desc' as const }

    const cacheKey = buildCacheKey('inventory:licenses', {
      uid: session.user.id,
      role: session.user.role,
      page,
      limit,
      search: validatedFilters.search,
      assigned: validatedFilters.assigned,
      expired: validatedFilters.expired,
      supplierId,
      familyId,
      contractType,
      licenseScope,
      orderByParam,
    })

    const { licenses: rawLicenses, total } = await withCache(cacheKey, 10, async () => {
      const [licenses, total] = await Promise.all([
        prisma.software_licenses.findMany({
          where,
          include: {
            licenseType: { include: { family: true } },
            equipment: true,
            user: true,
            department: true,
            supplier: { select: { id: true, name: true } },
          },
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.software_licenses.count({ where }),
      ])
      return { licenses, total }
    })

    const warningDaysRaw = await getSetting('inventory.license_alert_days_first', 600, '30')
    const warningDays = Math.max(1, parseInt(warningDaysRaw ?? '30', 10) || 30)

    const processedLicenses = rawLicenses.map((l: any) => {
      const renewalAlertStatus = getRenewalAlertStatus(
        l.renewalDate ? new Date(l.renewalDate) : null,
        warningDays
      )
      const base =
        session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'
          ? l
          : { ...l, key: l.key ? '••••••••' : null }
      return { ...base, renewalAlertStatus }
    })

    return NextResponse.json({ licenses: processedLicenses, total, page, limit })
  } catch (error) {
    console.error('Error en GET /api/inventory/licenses:', error)
    if (error instanceof ZodError) {
      const first = error.errors[0]
      const field = first?.path?.join('.') || undefined
      const message = first?.message
        ? field
          ? `${first.message} (${field})`
          : first.message
        : 'Datos inválidos'
      return NextResponse.json({ error: message, field, details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener licencias' }, { status: 500 })
  }
}
