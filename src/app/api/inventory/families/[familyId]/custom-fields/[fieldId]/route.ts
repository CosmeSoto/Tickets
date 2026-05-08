import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * PUT /api/inventory/families/[familyId]/custom-fields/[fieldId]
 * Actualiza un campo personalizado
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string; fieldId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { fieldId } = await params
    const body = await request.json()

    const field = await prisma.family_custom_fields.update({
      where: { id: fieldId },
      data: {
        fieldLabel: body.fieldLabel,
        fieldType: body.fieldType,
        fieldOptions: body.fieldOptions || null,
        isRequired: body.isRequired || false,
        helpText: body.helpText || null,
        order: body.order,
      },
    })

    return NextResponse.json(field)
  } catch (error) {
    console.error('Error en PUT /api/inventory/families/[familyId]/custom-fields/[fieldId]:', error)
    return NextResponse.json({ error: 'Error al actualizar campo personalizado' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory/families/[familyId]/custom-fields/[fieldId]
 * Elimina un campo personalizado
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string; fieldId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { fieldId } = await params

    await prisma.family_custom_fields.delete({
      where: { id: fieldId },
    })

    return NextResponse.json({ message: 'Campo eliminado exitosamente' })
  } catch (error) {
    console.error(
      'Error en DELETE /api/inventory/families/[familyId]/custom-fields/[fieldId]:',
      error
    )
    return NextResponse.json({ error: 'Error al eliminar campo personalizado' }, { status: 500 })
  }
}
