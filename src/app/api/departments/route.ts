import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

// Schema de validación
const departmentSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  description: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i, 'Color inválido')
    .optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  familyId: z.string().nullable().optional(),
})

// GET /api/departments - Listar departamentos
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isActive = searchParams.get('isActive')
    const publicAccess = searchParams.get('public') === 'true'
    const familyId = searchParams.get('familyId')

    // Acceso público — departamentos activos sin autenticación (para registro)
    if (publicAccess) {
      const departments = await prisma.departments.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          color: true,
          familyId: true,
          family: { select: { id: true, name: true, code: true, color: true } },
        },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })
      return NextResponse.json(
        { success: true, departments },
        { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=240' } }
      )
    }

    // Acceso autenticado
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const where: any = {}
    if (isActive !== null) where.isActive = isActive === 'true'
    if (familyId) where.familyId = familyId

    // Admin Normal: solo departamentos de sus familias (Union_Scope = General + Inventory + Patrols + Nativa)
    if (session.user.role === 'ADMIN' && !(session.user as any).isSuperAdmin && !familyId) {
      const { getAdminFamilyScope, getModuleFamilyIds } = await import('@/lib/auth/admin-scope')
      const scope = await getAdminFamilyScope(session.user.id, false)
      const inventoryFamilyIds = await getModuleFamilyIds(session.user.id, 'inventory')
      const patrolFamilyIds = await getModuleFamilyIds(session.user.id, 'patrols')

      // Union_Scope: combinar todas las familias de todos los módulos (deduplicado)
      const unionSet = new Set<string>()
      if (scope.familyIds) {
        scope.familyIds.forEach(id => unionSet.add(id))
      }
      inventoryFamilyIds.forEach(id => unionSet.add(id))
      patrolFamilyIds.forEach(id => unionSet.add(id))

      if (unionSet.size > 0) {
        where.familyId = { in: Array.from(unionSet) }
      }
    }

    const departments = await prisma.departments.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      take: 500,
      include: {
        family: { select: { id: true, name: true, code: true, color: true } },
        _count: { select: { users: true, categories: true } },
      },
    })

    return NextResponse.json({ success: true, data: departments })
  } catch (error) {
    console.error('❌ Error al cargar departamentos:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al cargar departamentos',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

// POST /api/departments - Crear departamento; ADMIN solo en sus familias
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const currentUser = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    const body = await request.json()
    const validatedData = departmentSchema.parse(body)

    // Todo departamento nuevo debe pertenecer a una familia
    if (!validatedData.familyId) {
      return NextResponse.json(
        {
          success: false,
          error: 'familyId es requerido: todo departamento debe pertenecer a una familia',
        },
        { status: 400 }
      )
    }

    const targetFamily = await prisma.families.findUnique({
      where: { id: validatedData.familyId },
      select: { id: true, isActive: true },
    })
    if (!targetFamily) {
      return NextResponse.json(
        { success: false, error: 'La familia indicada no existe' },
        { status: 400 }
      )
    }

    if (!currentUser?.isSuperAdmin) {
      const { getAdminFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getAdminFamilyScope(session.user.id, false)
      const allowedFamilyIds = scope.familyIds ? new Set(scope.familyIds) : new Set()

      if (!allowedFamilyIds.has(validatedData.familyId)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Solo puede crear departamentos en las familias que tiene asignadas',
          },
          { status: 403 }
        )
      }
    }

    // Verificar si ya existe un departamento con ese nombre
    const existing = await prisma.departments.findUnique({
      where: { name: validatedData.name },
    })

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya existe un departamento con ese nombre',
        },
        { status: 400 }
      )
    }

    const department = await prisma.departments.create({
      data: {
        id: randomUUID(),
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color || '#3B82F6',
        isActive: validatedData.isActive ?? true,
        order: validatedData.order ?? 0,
        familyId: validatedData.familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: {
            users: true,
            categories: true,
          },
        },
      },
    })

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.DEPARTMENT_CREATED,
      entityType: 'department',
      entityId: department.id,
      userId: session.user.id,
      details: {
        departmentName: department.name,
        description: department.description,
        color: department.color,
        isActive: department.isActive,
      },
      request,
    })

    // Invalidar cache de departamentos
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await invalidateCache(['departments:*'])
    } catch {
      /* Redis no disponible */
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Departamento creado:', department.name)
    }

    return NextResponse.json({
      success: true,
      data: department,
      message: `Departamento "${department.name}" creado exitosamente`,
    })
  } catch (error) {
    console.error('❌ Error al crear departamento:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear departamento',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
