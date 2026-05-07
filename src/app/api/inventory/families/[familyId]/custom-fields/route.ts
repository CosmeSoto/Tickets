import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CustomFieldsService } from '@/lib/services/custom-fields.service'
import { ZodError, z } from 'zod'

// Schema de validación
const createCustomFieldSchema = z.object({
  fieldName: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_]+$/, 'Solo minúsculas y guiones bajos'),
  fieldLabel: z.string().min(1).max(100),
  fieldType: z.enum(['text', 'number', 'select', 'date', 'boolean']),
  fieldOptions: z.any().optional(),
  isRequired: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  helpText: z.string().max(255).optional(),
})

/**
 * GET /api/inventory/families/[familyId]/custom-fields
 * Obtiene todos los campos personalizados de una familia
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

    const fields = await CustomFieldsService.getCustomFieldsByFamily(familyId)

    return NextResponse.json(fields)
  } catch (error) {
    console.error('Error obteniendo custom fields:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener campos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/families/[familyId]/custom-fields
 * Crea un nuevo campo personalizado para una familia
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

    // Solo ADMIN puede crear custom fields
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para crear campos personalizados' },
        { status: 403 }
      )
    }

    const { familyId } = await params
    const body = await request.json()

    // Validar datos
    const validatedData = createCustomFieldSchema.parse(body)

    // Crear campo
    const field = await CustomFieldsService.createCustomField({
      familyId,
      ...validatedData,
    })

    return NextResponse.json(field, { status: 201 })
  } catch (error) {
    console.error('Error creando custom field:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al crear campo' },
      { status: 500 }
    )
  }
}
