import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * @deprecated Este endpoint está deprecado y será eliminado el 2026-06-08.
 * Usa en su lugar: GET /api/admin/inventory/{type}-types/[typeId]/attributes
 * 
 * GET /api/inventory/families/[familyId]/custom-fields
 * Obtiene los campos personalizados de una familia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId } = await params

    const fields = await prisma.family_custom_fields.findMany({
      where: { familyId },
      orderBy: { order: 'asc' },
    })

    const response = NextResponse.json(fields)
    response.headers.set('X-Deprecated', 'true')
    response.headers.set('X-Deprecated-Date', '2026-06-08')
    response.headers.set('X-Deprecated-Replacement', 'GET /api/admin/inventory/{type}-types/[typeId]/attributes')
    response.headers.set('Warning', '299 - "Este endpoint está deprecado. Usa /api/admin/inventory/{type}-types/[typeId]/attributes"')
    
    return response
  } catch (error) {
    console.error('Error en GET /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al obtener campos personalizados' }, { status: 500 })
  }
}

/**
 * @deprecated Este endpoint está deprecado y será eliminado el 2026-06-08.
 * Usa en su lugar: POST /api/admin/inventory/{type}-types/[typeId]/attributes
 * 
 * POST /api/inventory/families/[familyId]/custom-fields
 * Crea un nuevo campo personalizado
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { familyId } = await params
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
    response.headers.set('X-Deprecated-Date', '2026-06-08')
    response.headers.set('X-Deprecated-Replacement', 'POST /api/admin/inventory/{type}-types/[typeId]/attributes')
    response.headers.set('Warning', '299 - "Este endpoint está deprecado. Usa /api/admin/inventory/{type}-types/[typeId]/attributes"')
    
    return response
  } catch (error) {
    console.error('Error en POST /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al crear campo personalizado' }, { status: 500 })
  }
}
