import { NextRequest, NextResponse } from 'next/server'
import { ValidationService } from '@/lib/services/validation-inventory.service'
import { z } from 'zod'

const validateCodeSchema = z.object({
  code: z.string().min(1),
  excludeId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, excludeId } = validateCodeSchema.parse(body)

    const result = await ValidationService.validateCodeUniqueness(code, excludeId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error validating code:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al validar código' }, { status: 500 })
  }
}
