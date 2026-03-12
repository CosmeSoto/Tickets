import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * GET /api/admin/sla-policies
 * Obtener todas las políticas de SLA
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const priority = searchParams.get('priority')
    const categoryId = searchParams.get('categoryId')

    const where: any = {}
    
    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }
    
    if (priority) {
      where.priority = priority
    }
    
    if (categoryId) {
      where.categoryId = categoryId
    }

    const policies = await prisma.sla_policies.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        },
        _count: {
          select: {
            ticket_sla_metrics: true,
            sla_violations: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { 
          priority: 'asc' // URGENT, HIGH, MEDIUM, LOW
        }
      ]
    })

    return NextResponse.json({
      success: true,
      data: policies
    })
  } catch (error) {
    console.error('Error fetching SLA policies:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar políticas de SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/sla-policies
 * Crear nueva política de SLA
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const data = await request.json()

    // Validaciones
    if (!data.name?.trim()) {
      return NextResponse.json(
        { success: false, message: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    if (!data.priority) {
      return NextResponse.json(
        { success: false, message: 'La prioridad es requerida' },
        { status: 400 }
      )
    }

    if (!['URGENT', 'HIGH', 'MEDIUM', 'LOW'].includes(data.priority)) {
      return NextResponse.json(
        { success: false, message: 'Prioridad inválida' },
        { status: 400 }
      )
    }

    if (!data.responseTimeHours || data.responseTimeHours < 1) {
      return NextResponse.json(
        { success: false, message: 'Tiempo de respuesta inválido' },
        { status: 400 }
      )
    }

    if (!data.resolutionTimeHours || data.resolutionTimeHours < 1) {
      return NextResponse.json(
        { success: false, message: 'Tiempo de resolución inválido' },
        { status: 400 }
      )
    }

    // Verificar si ya existe una política para esta prioridad y categoría
    const existing = await prisma.sla_policies.findFirst({
      where: {
        priority: data.priority,
        categoryId: data.categoryId || null,
        isActive: true
      }
    })

    if (existing) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Ya existe una política activa para esta prioridad' + 
                   (data.categoryId ? ' y categoría' : '')
        },
        { status: 400 }
      )
    }

    // Crear política
    const policy = await prisma.sla_policies.create({
      data: {
        id: randomUUID(),
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        priority: data.priority,
        responseTimeHours: parseInt(data.responseTimeHours),
        resolutionTimeHours: parseInt(data.resolutionTimeHours),
        businessHoursOnly: data.businessHoursOnly || false,
        businessHoursStart: data.businessHoursStart || '09:00:00',
        businessHoursEnd: data.businessHoursEnd || '18:00:00',
        businessDays: data.businessDays || 'MON,TUE,WED,THU,FRI',
        isActive: data.isActive !== false
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: policy,
      message: 'Política de SLA creada exitosamente'
    })
  } catch (error) {
    console.error('Error creating SLA policy:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear política de SLA',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
