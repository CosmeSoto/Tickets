import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { normalizePhoneInput, validatePhoneInput } from '@/lib/auth/profile-completion'

const schema = z.object({
  departmentId: z.string().min(1, 'Departamento requerido'),
  phone: z.string().min(1, 'Teléfono celular requerido'),
})

/**
 * POST /api/auth/oauth-register-context
 * Guarda departamento y teléfono antes del redirect OAuth (cookies 10 min).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const phoneError = validatePhoneInput(parsed.data.phone)
    if (phoneError) {
      return NextResponse.json({ success: false, error: phoneError }, { status: 400 })
    }

    const phone = normalizePhoneInput(parsed.data.phone)

    const department = await prisma.departments.findFirst({
      where: { id: parsed.data.departmentId, isActive: true },
      select: { id: true },
    })

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'El departamento seleccionado no existe o no está activo' },
        { status: 400 }
      )
    }

    const response = NextResponse.json({ success: true })
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 10 * 60,
      path: '/',
    }
    response.cookies.set('oauth_register_dept', department.id, cookieOptions)
    response.cookies.set('oauth_register_phone', phone, cookieOptions)
    return response
  } catch (error) {
    console.error('[oauth-register-context]', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo preparar el registro OAuth' },
      { status: 500 }
    )
  }
}
