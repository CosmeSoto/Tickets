import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CustomFieldsService } from '@/lib/services/custom-fields.service'
import { ZodError, z } from 'zod'

// Schema de validación
const updateCustomFieldSchema = z.object({
  fieldLabel: z.string().min(1).max(100).optional(),
  fieldType: z.enum(['text', 'number', 'select', 'date', 'boolean']).optional(),
  fieldOptions: z.any().optional(),
  isRequired: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  helpText: z.string().max(255).optional(),
})

/**
 * GET /api/inventory/families/[familyId]/custom-fields/[fieldId]
 * Obtiene un campo personalizado por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ familyId: string; fieldId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { fieldId } = await params

    const field = await CustomFieldsService.getCustomFieldById(fieldId)

    if (!field) {
      return NextResponse.json({ error: 'Campo no encontrado' }, { status: 404 })
    }

    return NextResponse.json(field)
  } catch (error) {
    console.error('Error obteniendo custom field:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener campo' },
      { status: 500 }
    )
  }
}

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

    // Solo ADMIN puede actualizar custom fields
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para actualizar campos personalizados' },
        { status: 403 }
      )
    }

    const { fieldId } = await params
    const body = await request.json()

    // Validar datos
    const validatedData = updateCustomFieldSchema.parse(body)

    // Actualizar campo
    const field = await CustomFieldsService.updateCustomField(fieldId, validatedData)

    return NextResponse.json(field)
  } catch (error) {
    console.error('Error actualizando custom field:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar campo' },
      { status: 500 }
    )
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

    // Solo ADMIN puede eliminar custom fields
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para eliminar campos personalizados' },
        { status: 403 }
      )
    }

    const { fieldId } = await params

    await CustomFieldsService.deleteCustomField(fieldId)

    return NextResponse.json({ message: 'Campo eliminado exitosamente' })
  } catch (error) {
    console.error('Error eliminando custom field:', error)

    if (error instanceof Error && error.message.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar campo' },
      { status: 500 }
    )
  }
}
