import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  responseTimeHours: z.number().min(1).optional(),
  resolutionTimeHours: z.number().min(1).optional(),
  businessHoursOnly: z.boolean().optional(),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  businessDays: z.string().optional(),
  isActive: z.boolean().optional()
})

/**
 * PUT /api/admin/sla/policies/[id]
 * Actualizar política SLA
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Datos inválidos',
          errors: validation.error.errors
        },
        { status: 400 }
      )
    }

    const policy = await prisma.sla_policies.update({
      where: { id },
      data: {
        ...validation.data,
        updatedAt: new Date()
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: policy,
      message: 'Política SLA actualizada exitosamente'
    })
  } catch (error) {
    console.error('[SLA] Error actualizando política:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar política SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/sla/policies/[id]
 * Eliminar política SLA
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params

    await prisma.sla_policies.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: 'Política SLA eliminada exitosamente'
    })
  } catch (error) {
    console.error('[SLA] Error eliminando política:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar política SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
