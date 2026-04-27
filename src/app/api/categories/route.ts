import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { canManageCategory, getDepartmentFamilyId } from '@/lib/category-access'

/**
 * Obtiene el nombre del nivel basado en el número
 */
function getLevelName(level: number): string {
  switch (level) {
    case 1: return 'Principal'
    case 2: return 'Subcategoría'
    case 3: return 'Especialidad'
    case 4: return 'Detalle'
    default: return 'Máximo'
  }
}

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
    
    const isActive = searchParams.get('isActive')
    const level = searchParams.get('level')
    const parentId = searchParams.get('parentId')
    const familyId = searchParams.get('familyId')

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

    // Filtrar por familia a través del departamento
    if (familyId) {
      where.departments = { familyId }
    }

    // Para ADMIN no-superadmin: restringir a familias asignadas
    // Para TECHNICIAN/CLIENT: solo categorías activas de sus familias
    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true

    if (role === 'ADMIN' && !isSuperAdmin && !familyId) {
      try {
        const assignments = await prisma.admin_family_assignments.findMany({
          where: { adminId: session.user.id, isActive: true },
          select: { familyId: true },
        })
        if (assignments.length > 0) {
          const allowedFamilyIds = assignments.map(a => a.familyId)
          // Solo aplicar restricción si tiene asignaciones explícitas
          where.departments = { familyId: { in: allowedFamilyIds } }
        }
        // Si no tiene asignaciones, ve todas (compatibilidad con admins existentes)
      } catch {
        // Si la tabla no existe, no restringir
      }
    }

    // Obtener categorías con relaciones
    const categories = await prisma.categories.findMany({
      where,
      select: {        id: true,
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
            description: true,
            familyId: true,
            family: {
              select: {
                id: true,
                name: true,
                code: true,
                color: true,
              }
            }
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
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            level: true,
            parentId: true,
            categories: {
              select: {
                id: true,
                name: true,
                color: true,
                level: true,
                parentId: true,
                categories: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    level: true,
                    parentId: true
                  }
                }
              }
            }
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
            technician_assignments: true,
            knowledge_articles: true,
            sla_policies: true,
          }
        }
      },
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' }
      ],
      take: 2000, // cap de seguridad — árbol de categorías raramente supera esto
    })

    // Enriquecer categorías con canDelete y levelName
    const enrichedCategories = categories.map(category => ({
      ...category,
      levelName: getLevelName(category.level),
      canDelete: category._count.tickets === 0 && category._count.other_categories === 0,
    }))

    // Log para debugging en desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Categories loaded:', enrichedCategories.length)
      if (enrichedCategories.length > 0) {
        console.log('📊 Sample category:', JSON.stringify(enrichedCategories[0], null, 2))
      }
    }

    const response = {
      success: true,
      data: enrichedCategories,
      meta: {
        total: enrichedCategories.length,
        filters: { isActive, level, parentId, familyId }
      }
    }

    // Guardar en caché
    try { const { setCache } = await import('@/lib/redis'); await setCache(cacheKey, response, 180) } catch {}

    return NextResponse.json(response)
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

    // Solo ADMIN puede crear categorías
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Solo los administradores pueden crear categorías' },
        { status: 403 }
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

    if (!departmentId) {
      return NextResponse.json(
        { success: false, message: 'El departamento es requerido' },
        { status: 400 }
      )
    }

    // Validar que el admin tiene permiso en la familia del departamento
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const targetFamilyId = await getDepartmentFamilyId(departmentId)
    const hasPermission = await canManageCategory(session.user.id, isSuperAdmin, targetFamilyId)
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: 'No tienes permiso para crear categorías en esta área' },
        { status: 403 }
      )
    }

    // Validar que no exista una categoría con el mismo nombre en el mismo nivel y padre
    const existing = await prisma.categories.findFirst({
      where: {
        name: name.trim(),
        level,
        parentId: parentId || null,
      }
    })

    if (existing) {
      return NextResponse.json(
        { success: false, message: `Ya existe una categoría "${name}" en este nivel y padre` },
        { status: 409 }
      )
    }

    // Crear categoría
    const category = await prisma.categories.create({
      data: {
        id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
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
            technician_assignments: true,
            knowledge_articles: true,
            sla_policies: true,
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

    // Notificación in-app a otros admins
    const admins = await prisma.users.findMany({
      where: { role: 'ADMIN', isActive: true, id: { not: session.user.id } },
      select: { id: true },
    })
    // Notificación in-app a otros admins
    await Promise.all(admins.map(admin =>
      NotificationService.push({
        userId: admin.id,
        type: 'INFO',
        title: `Nueva categoría creada: ${category.name}`,
        message: `Se creó la categoría "${category.name}" (Nivel ${category.level}) en el departamento ${category.departments?.name ?? 'sin departamento'}.`,
      }).catch(err => console.error('[NOTIFY] Error:', err))
    ))

    // Invalidar caché de categorías
    await invalidateCache(['categories:role=ADMIN*', 'categories:role=TECHNICIAN*', 'categories:role=CLIENT*']).catch(() => {})

    // Enriquecer con canDelete y levelName
    const enrichedCategory = {
      ...category,
      levelName: getLevelName(category.level),
      canDelete: category._count.tickets === 0 && category._count.other_categories === 0,
    }

    return NextResponse.json({
      success: true,
      data: enrichedCategory,
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
