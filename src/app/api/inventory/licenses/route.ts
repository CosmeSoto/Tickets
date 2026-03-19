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

    const validatedFilters = licenseFiltersSchema.parse(filters)
    const result = await LicenseService.listLicenses(validatedFilters, session.user.role)

    return NextResponse.json(result)
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
