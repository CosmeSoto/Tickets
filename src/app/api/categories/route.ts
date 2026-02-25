import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parámetros de consulta
    const isActive = searchParams.get('isActive')
    const level = searchParams.get('level')
    const parentId = searchParams.get('parentId')

    // Construir filtros para Prisma
    const where: any = {}

    if (isActive !== null) {
      where.isActive = isActive === 'true'
    }

    if (level) {
      where.level = parseInt(level)
    }

    if (parentId) {
      where.parentId = parentId
    }

    // Obtener categorías con relaciones
    const categories = await prisma.categories.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        level: true,
        parentId: true,
        departmentId: true,
        order: true,
        color: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        departments: {
          select: {
            id: true,
            name: true,
            color: true,
            description: true
          }
        },
        other_categories: {
          select: {
            id: true,
            name: true,
            color: true,
            level: true
          },
          where: {
            isActive: true
          }
        },
        technician_assignments: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            technicianId: true,
            priority: true,
            maxTickets: true,
            autoAssign: true,
            users: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            tickets: true,
            other_categories: true,
            technician_assignments: true
          }
        }
      },
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    // Log para debugging en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Categories loaded:', categories.length)
      if (categories.length > 0) {
        console.log('📊 Sample category:', JSON.stringify(categories[0], null, 2))
      }
    }

    return NextResponse.json({
      success: true,
      data: categories,
      meta: {
        total: categories.length,
        filters: {
          isActive,
          level,
          parentId
        }
      }
    })
  } catch (error) {
    console.error('Error in categories API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar las categorías',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, description, level, parentId, departmentId, color, order } = body

    // Validaciones
    if (!name || !level) {
      return NextResponse.json(
        { success: false, message: 'Nombre y nivel son requeridos' },
        { status: 400 }
      )
    }

    // Crear categoría
    const category = await prisma.categories.create({
      data: {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        level,
        parentId: parentId || null,
        departmentId: departmentId || null,
        color: color || '#6B7280',
        order: order || 0,
        isActive: true,
        updatedAt: new Date()
      },
      include: {
        departments: true,
        _count: {
          select: {
            tickets: true,
            other_categories: true,
            technician_assignments: true
          }
        }
      }
    })

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.CATEGORY_CREATED,
      entityType: 'category',
      entityId: category.id,
      userId: session.user.id,
      details: {
        categoryName: category.name,
        description: category.description,
        level: category.level,
        parentId: category.parentId,
        departmentId: category.departmentId,
        color: category.color
      },
      request
    })

    return NextResponse.json({
      success: true,
      data: category,
      message: 'Categoría creada exitosamente'
    })
  } catch (error) {
    console.error('Error creating category:', error)
    
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear la categoría',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
