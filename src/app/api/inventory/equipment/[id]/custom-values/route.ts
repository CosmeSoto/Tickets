import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { CustomFieldsService } from '@/lib/services/custom-fields.service'
import { ZodError, z } from 'zod'

// Schema de validación
const setCustomValueSchema = z.object({
  fieldName: z.string().min(1),
  fieldValue: z.string(),
})

const setMultipleValuesSchema = z.array(
  z.object({
    fieldName: z.string().min(1),
    fieldValue: z.string(),
  })
)

/**
 * GET /api/inventory/equipment/[id]/custom-values
 * Obtiene todos los valores personalizados de un equipo con sus definiciones
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id: equipmentId } = await params

    const valuesWithDefinitions =
      await CustomFieldsService.getCustomValuesWithDefinitions(equipmentId)

    return NextResponse.json(valuesWithDefinitions)
  } catch (error) {
    console.error('Error obteniendo custom values:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener valores' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/equipment/[id]/custom-values
 * Establece el valor de un campo personalizado para un equipo
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo usuarios con permisos de gestión pueden establecer valores
    if (!session.user.canManageInventory && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar valores personalizados' },
        { status: 403 }
      )
    }

    const { id: equipmentId } = await params
    const body = await request.json()

    // Validar datos
    const validatedData = setCustomValueSchema.parse(body)

    // Establecer valor
    const value = await CustomFieldsService.setCustomValue({
      equipmentId,
      ...validatedData,
    })

    return NextResponse.json(value, { status: 201 })
  } catch (error) {
    console.error('Error estableciendo custom value:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error && error.message.includes('no existe')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al establecer valor' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/equipment/[id]/custom-values
 * Establece múltiples valores personalizados para un equipo
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo usuarios con permisos de gestión pueden establecer valores
    if (!session.user.canManageInventory && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No tienes permisos para modificar valores personalizados' },
        { status: 403 }
      )
    }

    const { id: equipmentId } = await params
    const body = await request.json()

    // Validar datos
    const validatedData = setMultipleValuesSchema.parse(body)

    // Establecer valores
    const values = await CustomFieldsService.setMultipleCustomValues(equipmentId, validatedData)

    return NextResponse.json(values)
  } catch (error) {
    console.error('Error estableciendo custom values:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al establecer valores' },
      { status: 500 }
    )
  }
}
