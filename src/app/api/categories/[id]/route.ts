import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { CategoryNotificationService } from '@/lib/services/category-notification-service'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const updateCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es muy largo').transform(s => s.trim()),
  description: z.string().optional().transform(s => s?.trim() || ''),
  parentId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color inválido').default('#6B7280'),
  isActive: z.boolean().default(true),
  assignedTechnicians: z.array(z.object({
    id: z.string().min(1, 'ID de técnico requerido'),
    priority: z.number().min(1, 'Prioridad mínima es 1').max(10, 'Prioridad máxima es 10'),
    maxTickets: z.number().optional().nullable(),
    autoAssign: z.boolean().default(false)
  })).optional().default([]),
})

// GET individual category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [API-CATEGORY] GET individual - ID:', id)
    }
    
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const category = await prisma.categories.findUnique({
      where: { id },
      include: {
        departments: {
          select: { id: true, name: true, color: true, description: true }
        },
        other_categories: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { tickets: true, other_categories: true }
        },
        technician_assignments: {
          where: { isActive: true },
          include: {
            users: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const enrichedCategory = {
      ...category,
      levelName: getLevelName(category.level),
      canDelete: category._count.tickets === 0 && category._count.other_categories === 0,
      assignedTechnicians: category.technician_assignments.map(assignment => ({
        id: assignment.users.id,
        name: assignment.users.name,
        email: assignment.users.email,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets,
        autoAssign: assignment.autoAssign
      }))
    }

    return NextResponse.json({
      success: true,
      data: enrichedCategory
    })

  } catch (error) {
    console.error('❌ [API-CATEGORY] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// PUT - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔄 [API-CATEGORY] PUT - ID:', id)
    
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que la categoría existe
    const existingCategory = await prisma.categories.findUnique({
      where: { id },
      select: { 
        id: true, 
        level: true, 
        name: true, 
        parentId: true,
        description: true,
        color: true,
        isActive: true,
        departmentId: true
      }
    })

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()
    console.log('📝 [API-CATEGORY] Datos recibidos:', JSON.stringify(body, null, 2))
    
    let validatedData
    try {
      validatedData = updateCategorySchema.parse(body)
      console.log('✅ [API-CATEGORY] Datos validados:', JSON.stringify(validatedData, null, 2))
    } catch (validationError) {
      console.error('❌ [API-CATEGORY] Error de validación:', validationError)
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Datos inválidos', 
            details: validationError.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
              received: e.received
            }))
          },
          { status: 400 }
        )
      }
      throw validationError
    }
    
    // Calcular nivel si cambió el padre
    let level = existingCategory.level
    if (validatedData.parentId !== existingCategory.parentId) {
      if (validatedData.parentId) {
        const parent = await prisma.categories.findUnique({
          where: { id: validatedData.parentId },
          select: { level: true }
        })
        
        if (!parent) {
          return NextResponse.json(
            { success: false, error: 'Categoría padre no encontrada' },
            { status: 400 }
          )
        }
        
        if (parent.level >= 4) {
          return NextResponse.json(
            { success: false, error: 'No se pueden crear más de 4 niveles de categorías' },
            { status: 400 }
          )
        }
        
        level = parent.level + 1
      } else {
        level = 1
      }
    }
    
    // Verificar nombre único (excluyendo la categoría actual)
    const duplicateCategory = await prisma.categories.findFirst({
      where: {
        name: validatedData.name,
        parentId: validatedData.parentId || null,
        level: level,
        id: { not: id }
      }
    })
    
    if (duplicateCategory) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una categoría con ese nombre en este nivel' },
        { status: 400 }
      )
    }

    // Detectar cambios para auditoría
    const changes: Record<string, { old: any, new: any }> = {}
    if (validatedData.name !== existingCategory.name) {
      changes.name = { old: existingCategory.name, new: validatedData.name }
    }
    if (validatedData.isActive !== existingCategory.isActive) {
      changes.isActive = { old: existingCategory.isActive, new: validatedData.isActive }
    }
    if (validatedData.parentId !== existingCategory.parentId) {
      changes.parentId = { old: existingCategory.parentId, new: validatedData.parentId }
    }
    if (validatedData.color !== existingCategory.color) {
      changes.color = { old: existingCategory.color, new: validatedData.color }
    }
    if (validatedData.description !== existingCategory.description) {
      changes.description = { old: existingCategory.description, new: validatedData.description }
    }
    if (validatedData.departmentId !== existingCategory.departmentId) {
      changes.departmentId = { old: existingCategory.departmentId, new: validatedData.departmentId }
    }
    
    // Actualizar categoría
    const updatedCategory = await prisma.categories.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        isActive: validatedData.isActive,
        departmentId: validatedData.departmentId || null,
        level,
        parentId: validatedData.parentId || null,
        updatedAt: new Date()
      },
      include: {
        departments: { select: { id: true, name: true, color: true, description: true } },
        other_categories: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: { select: { tickets: true, other_categories: true } },
        technician_assignments: {
          where: { isActive: true },
          include: {
            users: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    // Actualizar asignaciones de técnicos si se proporcionaron
    if (validatedData.assignedTechnicians !== undefined) {
      // Desactivar todas las asignaciones existentes
      await prisma.technician_assignments.updateMany({
        where: { categoryId: id },
        data: { isActive: false, updatedAt: new Date() }
      })

      // Crear nuevas asignaciones
      if (validatedData.assignedTechnicians.length > 0) {
        await prisma.technician_assignments.createMany({
          data: validatedData.assignedTechnicians.map(tech => ({
            id: randomUUID(),
            technicianId: tech.id,
            categoryId: id,
            priority: tech.priority,
            maxTickets: tech.maxTickets,
            autoAssign: tech.autoAssign,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          skipDuplicates: true
        })
      }

      // Recargar la categoría con las nuevas asignaciones
      const categoryWithNewAssignments = await prisma.categories.findUnique({
        where: { id },
        include: {
          departments: { select: { id: true, name: true, color: true, description: true } },
          other_categories: {
            select: { id: true, name: true, color: true, level: true, isActive: true },
            where: { isActive: true },
            orderBy: { name: 'asc' }
          },
          _count: { select: { tickets: true, other_categories: true } },
          technician_assignments: {
            where: { isActive: true },
            include: {
              users: {
                select: { id: true, name: true, email: true }
              }
            }
          }
        }
      })

      if (categoryWithNewAssignments) {
        // Registrar auditoría
        try {
          await AuditServiceComplete.logAction({
            userId: session.user.id,
            action: AuditActionsComplete.CATEGORY_UPDATED,
            resource: 'categories',
            resourceId: id,
            details: {
              categoryName: validatedData.name,
              changes,
              assignedTechnicians: validatedData.assignedTechnicians.length
            },
            metadata: {
              userAgent: request.headers.get('user-agent') || 'Unknown',
              ip: request.headers.get('x-forwarded-for') || 'Unknown'
            }
          })
        } catch (auditError) {
          console.error('Error registrando auditoría:', auditError)
        }

        // Enviar notificaciones de categoría actualizada
        try {
          await CategoryNotificationService.notifyCategoryUpdated(id, changes, session.user.id)
        } catch (notificationError) {
          console.error('Error enviando notificaciones de categoría actualizada:', notificationError)
        }

        const enrichedCategory = {
          ...categoryWithNewAssignments,
          levelName: getLevelName(categoryWithNewAssignments.level),
          canDelete: categoryWithNewAssignments._count.tickets === 0 && categoryWithNewAssignments._count.other_categories === 0,
          assignedTechnicians: categoryWithNewAssignments.technician_assignments.map(assignment => ({
            id: assignment.users.id,
            name: assignment.users.name,
            email: assignment.users.email,
            priority: assignment.priority,
            maxTickets: assignment.maxTickets,
            autoAssign: assignment.autoAssign
          }))
        }
        
        console.log('✅ [API-CATEGORY] Categoría actualizada con técnicos:', categoryWithNewAssignments.name)
        
        return NextResponse.json({
          success: true,
          data: enrichedCategory,
          message: 'Categoría actualizada exitosamente'
        })
      }
    }

    // Registrar auditoría
    try {
      await AuditServiceComplete.logAction({
        userId: session.user.id,
        action: AuditActionsComplete.CATEGORY_UPDATED,
        resource: 'categories',
        resourceId: id,
        details: {
          categoryName: validatedData.name,
          changes
        },
        metadata: {
          userAgent: request.headers.get('user-agent') || 'Unknown',
          ip: request.headers.get('x-forwarded-for') || 'Unknown'
        }
      })
    } catch (auditError) {
      console.error('Error registrando auditoría:', auditError)
    }

    // Enviar notificaciones de categoría actualizada
    try {
      await CategoryNotificationService.notifyCategoryUpdated(id, changes, session.user.id)
    } catch (notificationError) {
      console.error('Error enviando notificaciones de categoría actualizada:', notificationError)
    }
    
    const enrichedCategory = {
      ...updatedCategory,
      levelName: getLevelName(updatedCategory.level),
      canDelete: updatedCategory._count.tickets === 0 && updatedCategory._count.other_categories === 0,
      assignedTechnicians: updatedCategory.technician_assignments.map(assignment => ({
        id: assignment.users.id,
        name: assignment.users.name,
        email: assignment.users.email,
        priority: assignment.priority,
        maxTickets: assignment.maxTickets,
        autoAssign: assignment.autoAssign
      }))
    }
    
    console.log('✅ [API-CATEGORY] Categoría actualizada:', updatedCategory.name)
    
    return NextResponse.json({
      success: true,
      data: enrichedCategory,
      message: 'Categoría actualizada exitosamente'
    })
    
  } catch (error) {
    console.error('❌ [API-CATEGORY] Error PUT:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Datos inválidos', 
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            received: e.received
          }))
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

// DELETE category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🗑️ [API-CATEGORY] DELETE - ID:', id)
    
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que la categoría existe y se puede eliminar
    const category = await prisma.categories.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true, other_categories: true }
        },
        technician_assignments: {
          where: { isActive: true },
          include: {
            users: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    // Verificar que no tenga tickets o subcategorías
    if (category._count.tickets > 0) {
      return NextResponse.json(
        { success: false, error: `No se puede eliminar: la categoría tiene ${category._count.tickets} tickets asignados` },
        { status: 400 }
      )
    }

    if (category._count.other_categories > 0) {
      return NextResponse.json(
        { success: false, error: `No se puede eliminar: la categoría tiene ${category._count.other_categories} subcategorías` },
        { status: 400 }
      )
    }

    // Guardar datos para notificaciones antes de eliminar
    const deletedCategoryData = {
      name: category.name,
      level: category.level,
      assignedTechnicians: category.technician_assignments.map(assignment => ({
        users: {
          id: assignment.users.id,
          name: assignment.users.name,
          email: assignment.users.email
        }
      }))
    }

    // Eliminar asignaciones de técnicos primero
    await prisma.technician_assignments.deleteMany({
      where: { categoryId: id }
    })

    // Eliminar la categoría
    await prisma.categories.delete({
      where: { id }
    })

    // Enviar notificaciones de categoría eliminada
    try {
      await CategoryNotificationService.notifyCategoryDeleted(id, session.user.id)
    } catch (notificationError) {
      console.error('Error enviando notificaciones de categoría eliminada:', notificationError)
    }
    
    console.log('✅ [API-CATEGORY] Categoría eliminada:', category.name)
    
    return NextResponse.json({
      success: true,
      message: 'Categoría eliminada exitosamente'
    })
    
  } catch (error) {
    console.error('❌ [API-CATEGORY] Error DELETE:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

function getLevelName(level: number): string {
  switch (level) {
    case 1: return 'Principal'
    case 2: return 'Subcategoría'
    case 3: return 'Especialidad'
    case 4: return 'Detalle'
    default: return `Nivel ${level}`
  }
}