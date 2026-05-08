import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
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

    return NextResponse.json(fields)
  } catch (error) {
    console.error('Error en GET /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al obtener campos personalizados' }, { status: 500 })
  }
}

/**
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

    const field = await prisma.family_custom_fields.create({
      data: {
        familyId,
        fieldName: body.fieldName,
        fieldLabel: body.fieldLabel,
        fieldType: body.fieldType,
        fieldOptions: body.fieldOptions || null,
        isRequired: body.isRequired || false,
        helpText: body.helpText || null,
        order: body.order || 0,
      },
    })

    return NextResponse.json(field, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/families/[familyId]/custom-fields:', error)
    return NextResponse.json({ error: 'Error al crear campo personalizado' }, { status: 500 })
  }
}
