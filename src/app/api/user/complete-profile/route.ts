import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import {
  clientNeedsProfileCompletion,
  normalizePhoneInput,
  validatePhoneInput,
} from '@/lib/auth/profile-completion'

const completeProfileSchema = z.object({
  departmentId: z.string().min(1, 'Debes seleccionar un departamento'),
  phone: z.string().min(1, 'El teléfono celular es requerido'),
})

/**
 * POST /api/user/complete-profile
 * Completa departamento y teléfono para usuarios OAuth (clientes).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = completeProfileSchema.safeParse(body)
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

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        departmentId: true,
        phone: true,
      },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role !== 'CLIENT') {
      return NextResponse.json(
        { success: false, error: 'Solo los usuarios cliente deben completar este paso' },
        { status: 400 }
      )
    }

    if (
      !clientNeedsProfileCompletion({
        role: user.role,
        departmentId: user.departmentId,
        phone: user.phone,
      })
    ) {
      const existingDept = user.departmentId
        ? await prisma.departments.findUnique({
            where: { id: user.departmentId },
            select: { id: true, name: true },
          })
        : null
      return NextResponse.json({
        success: true,
        message: 'El perfil ya está completo',
        department: existingDept,
        phone: user.phone,
      })
    }

    const department = await prisma.departments.findFirst({
      where: { id: parsed.data.departmentId, isActive: true },
      select: { id: true, name: true },
    })

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'El departamento seleccionado no existe o no está activo' },
        { status: 400 }
      )
    }

    await prisma.users.update({
      where: { id: user.id },
      data: {
        departmentId: department.id,
        phone,
        updatedAt: new Date(),
      },
    })

    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(`auth:user:${user.id}`)
    } catch {
      /* Redis no disponible */
    }

    await AuditServiceComplete.log({
      action: AuditActionsComplete.USER_UPDATED,
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      details: {
        fields: ['departmentId', 'phone'],
        departmentId: department.id,
        departmentName: department.name,
        phone,
        source: 'complete_profile',
      },
      request,
    })

    return NextResponse.json({
      success: true,
      message: 'Perfil completado correctamente',
      department,
      phone,
    })
  } catch (error) {
    console.error('[complete-profile]', error)
    return NextResponse.json(
      { success: false, error: 'No se pudo completar el perfil' },
      { status: 500 }
    )
  }
}
