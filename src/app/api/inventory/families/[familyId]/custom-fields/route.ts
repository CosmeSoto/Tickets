import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  canReadModuleFamilyConfig,
  canWriteModuleFamilyConfig,
} from '@/lib/auth/module-config-access'

/**
 * @deprecated Preferir atributos por tipo bajo /api/admin/inventory/{type}-types/...
 *
 * GET /api/inventory/families/[familyId]/custom-fields
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId } = await params
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const allowed = await canReadModuleFamilyConfig(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId,
      'inventory'
    )
    if (!allowed) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const fields = await prisma.family_custom_fields.findMany({
      where: { familyId },
      orderBy: { order: 'asc' },
    })

    const response = NextResponse.json(fields)
    response.headers.set('X-Deprecated', 'true')
    return response
  } catch (error) {
    console.error('Error en GET /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al obtener campos personalizados' }, { status: 500 })
  }
}

/**
 * POST /api/inventory/families/[familyId]/custom-fields
 * @deprecated
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId } = await params
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const canWrite = await canWriteModuleFamilyConfig(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      familyId,
      'inventory'
    )
    if (!canWrite) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()

    let order = typeof body.order === 'number' ? body.order : undefined
    if (order == null) {
      const maxOrder = await prisma.family_custom_fields.aggregate({
        where: { familyId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    const field = await prisma.family_custom_fields.create({
      data: {
        familyId,
        fieldName: body.fieldName,
        fieldLabel: body.fieldLabel,
        fieldType: body.fieldType,
        fieldOptions: body.fieldOptions || null,
        isRequired: body.isRequired || false,
        helpText: body.helpText || null,
        order,
      },
    })

    const response = NextResponse.json(field, { status: 201 })
    response.headers.set('X-Deprecated', 'true')
    return response
  } catch (error) {
    console.error('Error en POST /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al crear campo personalizado' }, { status: 500 })
  }
}
