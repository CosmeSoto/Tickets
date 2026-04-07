import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'

const updateCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es muy largo').transform(s => s.trim()),
  description: z.string().optional().transform(s => s?.trim() || ''),
  parentId: z.string().optional().nullable(),
  departmentId: z.string().min(1, 'El departamento es requerido'),
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
          select: { id: true, name: true, color: true, description: true, familyId: true, family: { select: { id: true, name: true, code: true, color: true } } }
        },
        other_categories: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: {
          select: { tickets: true, other_categories: true, knowledge_articles: true, sla_policies: true }
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

    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Cargar estado anterior completo (para oldValues en auditoría)
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
        departmentId: true,
        departments: { select: { name: true, familyId: true, family: { select: { name: true } } } },
      }
    })

    if (!existingCategory) {
      return NextResponse.json(
        { success: false, error: 'Categoría no encontrada' },
        { status: 404 }
      )
    }

    const body = await request.json()

    let validatedData
    try {
      validatedData = updateCategorySchema.parse(body)
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Datos inválidos',
            details: validationError.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
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

    // Verificar nombre único
    const duplicateCategory = await prisma.categories.findFirst({
      where: {
        name: validatedData.name,
        parentId: validatedData.parentId || null,
        level,
        id: { not: id }
      }
    })
    if (duplicateCategory) {
      return NextResponse.json(
        { success: false, error: 'Ya existe una categoría con ese nombre en este nivel' },
        { status: 400 }
      )
    }

    // Resolver nombre del nuevo departamento para auditoría
    let newDeptName: string | null = null
    if (validatedData.departmentId) {
      const newDept = await prisma.departments.findUnique({
        where: { id: validatedData.departmentId },
        select: { name: true, family: { select: { name: true } } }
      })
      newDeptName = newDept?.name ?? null
    }

    // Construir oldValues / newValues para auditoría
    const oldValues: Record<string, any> = {
      name: existingCategory.name,
      description: existingCategory.description,
      color: existingCategory.color,
      isActive: existingCategory.isActive,
      parentId: existingCategory.parentId,
      departmentId: existingCategory.departmentId,
      departmentName: existingCategory.departments?.name ?? null,
      familyName: existingCategory.departments?.family?.name ?? null,
    }
    const newValues: Record<string, any> = {
      name: validatedData.name,
      description: validatedData.description,
      color: validatedData.color,
      isActive: validatedData.isActive,
      parentId: validatedData.parentId ?? null,
      departmentId: validatedData.departmentId,
      departmentName: newDeptName,
    }

    // Detectar cambios relevantes para notificación
    const deptChanged = validatedData.departmentId !== existingCategory.departmentId
    const nameChanged = validatedData.name !== existingCategory.name
    const statusChanged = validatedData.isActive !== existingCategory.isActive

    // Actualizar categoría
    const updatedCategory = await prisma.categories.update({
      where: { id },
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color,
        isActive: validatedData.isActive,
        departmentId: validatedData.departmentId,
        level,
        parentId: validatedData.parentId || null,
        updatedAt: new Date()
      },
      include: {
        departments: { select: { id: true, name: true, color: true, description: true, familyId: true, family: { select: { id: true, name: true, code: true, color: true } } } },
        other_categories: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: { select: { tickets: true, other_categories: true } },
        technician_assignments: {
          where: { isActive: true },
          include: { users: { select: { id: true, name: true, email: true } } }
        }
      }
    })

    // Actualizar asignaciones de técnicos
    if (validatedData.assignedTechnicians !== undefined) {
      await prisma.technician_assignments.updateMany({
        where: { categoryId: id },
        data: { isActive: false, updatedAt: new Date() }
      })
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
    }

    // Recargar con técnicos actualizados
    const finalCategory = await prisma.categories.findUnique({
      where: { id },
      include: {
        departments: { select: { id: true, name: true, color: true, description: true, familyId: true, family: { select: { id: true, name: true, code: true, color: true } } } },
        other_categories: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          where: { isActive: true },
          orderBy: { name: 'asc' }
        },
        _count: { select: { tickets: true, other_categories: true } },
        technician_assignments: {
          where: { isActive: true },
          include: { users: { select: { id: true, name: true, email: true } } }
        }
      }
    })

    // ── Auditoría con oldValues / newValues ──────────────────────────────────
    await AuditServiceComplete.log({
      action: AuditActionsComplete.CATEGORY_UPDATED,
      entityType: 'category',
      entityId: id,
      userId: session.user.id,
      oldValues,
      newValues,
      details: {
        categoryName: validatedData.name,
        changesCount: Object.keys(oldValues).filter(k => oldValues[k] !== newValues[k]).length,
        assignedTechnicians: validatedData.assignedTechnicians?.length ?? 0,
        deptChanged,
        nameChanged,
        statusChanged,
      },
      request,
    }).catch(err => console.error('[AUDIT] Error:', err))

    // ── Notificaciones in-app a todos los admins cuando cambia algo relevante ─
    if (deptChanged || nameChanged || statusChanged) {
      const admins = await prisma.users.findMany({
        where: { role: 'ADMIN', isActive: true, id: { not: session.user.id } },
        select: { id: true },
      })

      const notifParts: string[] = []
      if (nameChanged) notifParts.push(`nombre: "${existingCategory.name}" → "${validatedData.name}"`)
      if (deptChanged) notifParts.push(`departamento: "${existingCategory.departments?.name ?? 'ninguno'}" → "${newDeptName ?? 'ninguno'}"`)
      if (statusChanged) notifParts.push(`estado: ${existingCategory.isActive ? 'activa' : 'inactiva'} → ${validatedData.isActive ? 'activa' : 'inactiva'}`)

      const message = `Categoría actualizada — ${notifParts.join(', ')}`

      if (admins.length > 0) {
        await Promise.all(admins.map(admin =>
          NotificationService.push({
            userId: admin.id,
            type: 'INFO',
            title: `Categoría modificada: ${validatedData.name}`,
            message,
          }).catch(err => console.error('[NOTIFY] Error:', err))
        ))
      }
    }

    const enrichedCategory = {
      ...(finalCategory ?? updatedCategory),
      levelName: getLevelName(level),
      canDelete: (finalCategory ?? updatedCategory)._count.tickets === 0 &&
                 (finalCategory ?? updatedCategory)._count.other_categories === 0,
      assignedTechnicians: (finalCategory ?? updatedCategory).technician_assignments.map(a => ({
        id: a.users.id,
        name: a.users.name,
        email: a.users.email,
        priority: a.priority,
        maxTickets: a.maxTickets,
        autoAssign: a.autoAssign,
      }))
    }

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
            message: e.message
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
          select: {
            tickets: true,
            other_categories: true,
            knowledge_articles: true,
            sla_policies: true,
          }
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

    // Verificar restricciones de eliminación
    const errors: string[] = []
    if (category._count.tickets > 0)
      errors.push(`${category._count.tickets} ticket(s) asignado(s)`)
    if (category._count.other_categories > 0)
      errors.push(`${category._count.other_categories} subcategoría(s)`)

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar: la categoría tiene ${errors.join(' y ')}`,
          details: {
            tickets: category._count.tickets,
            subcategories: category._count.other_categories,
          }
        },
        { status: 400 }
      )
    }

    // Eliminar en orden: técnicos → artículos de conocimiento → políticas SLA → categoría
    await prisma.technician_assignments.deleteMany({ where: { categoryId: id } })
    await prisma.knowledge_articles.deleteMany({ where: { categoryId: id } })
    await prisma.sla_policies.deleteMany({ where: { categoryId: id } })

    // Eliminar la categoría
    await prisma.categories.delete({ where: { id } })

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.CATEGORY_DELETED,
      entityType: 'category',
      entityId: id,
      userId: session.user.id,
      details: {
        categoryName: category.name,
        level: category.level,
        ticketsCount: category._count.tickets,
        subcategoriesCount: category._count.other_categories,
        techniciansCount: category.technician_assignments.length,
        knowledgeArticlesDeleted: category._count.knowledge_articles,
        slaPoliciesDeleted: category._count.sla_policies,
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
        type: 'WARNING',
        title: `Categoría eliminada: ${category.name}`,
        message: `Se eliminó la categoría "${category.name}" (Nivel ${category.level}).`,
      }).catch(err => console.error('[NOTIFY] Error:', err))
    ))
    
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