import { NextRequest, NextResponse } from 'next/server'
import { ValidationService } from '@/lib/services/validation-inventory.service'
import { z } from 'zod'

const validateSerialSchema = z.object({
  serialNumber: z.string(),
  excludeId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { serialNumber, excludeId } = validateSerialSchema.parse(body)

    const result = await ValidationService.validateSerialUniqueness(serialNumber, excludeId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error validating serial:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al validar número de serie' }, { status: 500 })
  }
}
