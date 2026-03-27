import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseService } from '@/lib/services/license.service'
import { createLicenseSchema, licenseFiltersSchema } from '@/lib/validations/inventory/license'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { getRenewalAlertStatus } from '@/lib/inventory/renewal-alert'

/**
 * GET /api/inventory/licenses
 * Lista licencias con filtros y paginación
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
      const thirtyDays = new Date()
      thirtyDays.setDate(thirtyDays.getDate() + 30)
      where.expirationDate = { gte: now, lte: thirtyDays }
    }

    const orderBy = orderByParam === 'renewalDate'
      ? { renewalDate: 'asc' as const }
      : { createdAt: 'desc' as const }

    const page = validatedFilters.page || 1
    const limit = validatedFilters.limit || 10

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

    const processedLicenses = licenses.map(l => {
      const renewalAlertStatus = getRenewalAlertStatus(l.renewalDate ? new Date(l.renewalDate) : null)
      const base = session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN'
        ? l
        : { ...l, key: l.key ? '••••••••' : null }
      return { ...base, renewalAlertStatus }
    })

    return NextResponse.json({ licenses: processedLicenses, total, page, limit })
  } catch (error) {
    console.error('Error en GET /api/inventory/licenses:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener licencias' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/licenses
 * Crea una nueva licencia
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (!await canManageInventory(session.user.id, session.user.role)) {
      return inventoryForbidden()
    }

    const body = await request.json()
    const validatedData = createLicenseSchema.parse(body)
    const license = await LicenseService.createLicense(validatedData, session.user.id)

    await AuditServiceComplete.log({
      action: AuditActionsComplete.LICENSE_CREATED,
      entityType: 'inventory',
      entityId: license.id,
      userId: session.user.id,
      details: {
        name: validatedData.name,
        typeId: validatedData.typeId,
        vendor: validatedData.vendor,
        cost: validatedData.cost,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }).catch(err => console.error('[AUDIT] Error registrando creación de licencia:', err))

    // Notificar a admins (asíncrono)
    notifyAdminsNewLicense(license.name, license.licenseType?.name || 'Sin tipo', validatedData.cost).catch(
      err => console.error('[NOTIFICATION] Error notificando nueva licencia:', err)
    )

    return NextResponse.json(license, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/licenses:', error)
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al crear licencia' }, { status: 500 })
  }
}

async function notifyAdminsNewLicense(name: string, typeName: string, cost?: number) {
  const admins = await prisma.users.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })

  for (const admin of admins) {
    await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: admin.id,
        type: 'INFO',
        title: 'Nueva Licencia Registrada',
        message: `Se registró la licencia "${name}" (${typeName})${cost ? ` - $${cost}` : ''}`,
        metadata: { link: '/inventory/licenses' },
        isRead: false,
      },
    }).catch(() => {})
  }
}
