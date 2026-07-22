import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

const departmentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().nullable().optional(),
})

// GET /api/departments/[id] - Obtener departamento
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const department = await prisma.departments.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            categories: true,
          },
        },
      },
    })

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Departamento no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: department,
    })
  } catch (error) {
    console.error('❌ Error al obtener departamento:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener departamento' },
      { status: 500 }
    )
  }
}

// PUT /api/departments/[id] - Actualizar departamento; ADMIN solo en sus familias
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = departmentSchema.parse(body)

    // Verificar si el departamento existe
    const existing = await prisma.departments.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Departamento no encontrado' },
        { status: 404 }
      )
    }

    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getAdminFamilyScope(session.user.id, false)
      const allowedFamilyIds = scope.familyIds ? new Set(scope.familyIds) : new Set()

      // Verificar que el departamento existente esté en una familia permitida
      if (existing.familyId && !allowedFamilyIds.has(existing.familyId)) {
        return NextResponse.json(
          { success: false, error: 'No tiene permisos para editar este departamento' },
          { status: 403 }
        )
      }

      // Si se cambia la familia, verificar que la nueva familia también esté permitida
      if (validatedData.familyId !== undefined && validatedData.familyId !== existing.familyId) {
        if (validatedData.familyId && !allowedFamilyIds.has(validatedData.familyId)) {
          return NextResponse.json(
            {
              success: false,
              error: 'Solo puede asignar el departamento a las familias que tiene asignadas',
            },
            { status: 403 }
          )
        }
      }
    }

    // Si se cambia el nombre, verificar que no exista otro con ese nombre
    if (validatedData.name && validatedData.name !== existing.name) {
      const duplicate = await prisma.departments.findUnique({
        where: { name: validatedData.name },
      })

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: 'Ya existe un departamento con ese nombre' },
          { status: 400 }
        )
      }
    }

    // Todo departamento debe pertenecer a una familia (no se permite dejarlo huérfano)
    if (validatedData.familyId === null) {
      return NextResponse.json(
        {
          success: false,
          error: 'Todo departamento debe pertenecer a una familia. Use "Mover" para reasignarlo.',
        },
        { status: 400 }
      )
    }

    const isMovingFamily =
      validatedData.familyId !== undefined && validatedData.familyId !== existing.familyId

    if (isMovingFamily) {
      const targetFamily = await prisma.families.findUnique({
        where: { id: validatedData.familyId! },
        select: { id: true, name: true, isActive: true },
      })
      if (!targetFamily) {
        return NextResponse.json(
          { success: false, error: 'La familia destino no existe' },
          { status: 400 }
        )
      }
      if (!targetFamily.isActive) {
        return NextResponse.json(
          { success: false, error: 'La familia destino está inactiva' },
          { status: 400 }
        )
      }

      const openTicketsCount = await prisma.tickets.count({
        where: {
          categories: { departmentId: id },
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      })
      if (openTicketsCount > 0) {
        return NextResponse.json(
          {
            success: false,
            error: `No se puede cambiar la familia del departamento porque tiene ${openTicketsCount} ticket(s) abierto(s) o en progreso`,
          },
          { status: 409 }
        )
      }
    }

    // Preparar oldValues y newValues para auditoría
    const oldValues: any = {}
    const newValues: any = {}

    Object.keys(validatedData).forEach(key => {
      const typedKey = key as keyof typeof validatedData
      if (validatedData[typedKey] !== undefined && validatedData[typedKey] !== existing[typedKey]) {
        oldValues[key] = existing[typedKey]
        newValues[key] = validatedData[typedKey]
      }
    })

    const now = new Date()
    let categoriesSynced = 0

    const department = await prisma.$transaction(async tx => {
      const updated = await tx.departments.update({
        where: { id },
        data: { ...validatedData, updatedAt: now },
        include: {
          family: { select: { id: true, name: true, code: true, color: true } },
          _count: {
            select: {
              users: true,
              categories: true,
            },
          },
        },
      })

      // Al mover de familia: sincronizar categorías del departamento (tickets históricos no se tocan)
      if (isMovingFamily && validatedData.familyId) {
        const sync = await tx.categories.updateMany({
          where: {
            departmentId: id,
            OR: [{ familyId: null }, { familyId: { not: validatedData.familyId } }],
          },
          data: { familyId: validatedData.familyId, updatedAt: now },
        })
        categoriesSynced = sync.count
      }

      return updated
    })

    // Registrar en auditoría
    if (Object.keys(newValues).length > 0) {
      await AuditServiceComplete.log({
        action: AuditActionsComplete.DEPARTMENT_UPDATED,
        entityType: 'department',
        entityId: department.id,
        userId: session.user.id,
        details: {
          departmentName: department.name,
          ...(isMovingFamily
            ? {
                movedFamily: true,
                fromFamilyId: existing.familyId,
                toFamilyId: validatedData.familyId,
                categoriesSynced,
              }
            : {}),
        },
        oldValues,
        newValues,
        request,
      })
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Departamento actualizado:', department.name)
    }

    const message = isMovingFamily
      ? `Departamento "${department.name}" movido exitosamente${
          categoriesSynced > 0 ? ` (${categoriesSynced} categoría(s) sincronizada(s))` : ''
        }`
      : `Departamento "${department.name}" actualizado exitosamente`

    return NextResponse.json({
      success: true,
      data: department,
      categoriesSynced,
      message,
    })
  } catch (error) {
    console.error('❌ Error al actualizar departamento:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: 'Error al actualizar departamento' },
      { status: 500 }
    )
  }
}

// DELETE /api/departments/[id] - Eliminar departamento; ADMIN solo en sus familias
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Verificar si el departamento existe
    const department = await prisma.departments.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            categories: true,
          },
        },
      },
    })

    if (!department) {
      return NextResponse.json(
        { success: false, error: 'Departamento no encontrado' },
        { status: 404 }
      )
    }

    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    if (!currentUser?.isSuperAdmin) {
      const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getAdminFamilyScope(session.user.id, false)
      const allowedFamilyIds = scope.familyIds ? new Set(scope.familyIds) : new Set()

      if (department.familyId && !allowedFamilyIds.has(department.familyId)) {
        return NextResponse.json(
          { success: false, error: 'No tiene permisos para eliminar este departamento' },
          { status: 403 }
        )
      }
    }

    // Verificar si tiene usuarios o categorías asignadas
    if (department._count.users > 0 || department._count.categories > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede eliminar el departamento "${department.name}" porque tiene ${department._count.users} usuario(s) y ${department._count.categories} categoría(s) asignado(s)`,
          canDelete: false,
        },
        { status: 400 }
      )
    }

    await prisma.departments.delete({
      where: { id },
    })

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.DEPARTMENT_DELETED,
      entityType: 'department',
      entityId: department.id,
      userId: session.user.id,
      details: {
        departmentName: department.name,
        description: department.description,
        usersCount: department._count.users,
        categoriesCount: department._count.categories,
      },
      request,
    })

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Departamento eliminado:', department.name)
    }

    return NextResponse.json({
      success: true,
      message: `Departamento "${department.name}" eliminado exitosamente`,
    })
  } catch (error) {
    console.error('❌ Error al eliminar departamento:', error)
    return NextResponse.json(
      { success: false, error: 'Error al eliminar departamento' },
      { status: 500 }
    )
  }
}
