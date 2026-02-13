import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { z } from 'zod'

const policySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  responseTimeHours: z.number().min(1, 'Debe ser al menos 1 hora'),
  resolutionTimeHours: z.number().min(1, 'Debe ser al menos 1 hora'),
  businessHoursOnly: z.boolean().default(false),
  businessHoursStart: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).default('09:00:00'),
  businessHoursEnd: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).default('18:00:00'),
  businessDays: z.string().default('MON,TUE,WED,THU,FRI')
})

/**
 * GET /api/admin/sla/policies
 * Obtener todas las políticas SLA
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const policies = await prisma.sla_policies.findMany({
      orderBy: { createdAt: 'desc' },
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
      data: policies
    })
  } catch (error) {
    console.error('[SLA] Error obteniendo políticas:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener políticas SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/sla/policies
 * Crear una nueva política SLA
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()

    const validation = policySchema.safeParse(body)
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

    const data = validation.data

    // Verificar que no exista una política duplicada
    const existing = await prisma.sla_policies.findFirst({
      where: {
        categoryId: data.categoryId || null,
        priority: data.priority,
        isActive: true
      }
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ya existe una política activa para esta categoría y prioridad'
        },
        { status: 400 }
      )
    }

    const policy = await prisma.sla_policies.create({
      data: {
        id: randomUUID(),
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        priority: data.priority,
        responseTimeHours: data.responseTimeHours,
        resolutionTimeHours: data.resolutionTimeHours,
        businessHoursOnly: data.businessHoursOnly,
        businessHoursStart: data.businessHoursStart,
        businessHoursEnd: data.businessHoursEnd,
        businessDays: data.businessDays,
        isActive: true,
        createdAt: new Date(),
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
      message: 'Política SLA creada exitosamente'
    })
  } catch (error) {
    console.error('[SLA] Error creando política:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear política SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
