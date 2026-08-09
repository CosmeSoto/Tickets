import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canWriteModuleFamilyConfig } from '@/lib/auth/module-config-access'

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

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId, fieldId } = await params
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

    const existing = await prisma.family_custom_fields.findFirst({
      where: { id: fieldId, familyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 })
    }

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

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { familyId, fieldId } = await params
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

    const existing = await prisma.family_custom_fields.findFirst({
      where: { id: fieldId, familyId },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 })
    }

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
