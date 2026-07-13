import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssignmentService } from '@/lib/services/assignment.service'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import { InventoryDepartmentService } from '@/lib/services/inventory-department.service'
import { createAssignmentSchema } from '@/lib/validations/inventory/assignment'
import type { AssignmentFilters } from '@/types/inventory/assignment'
import { ZodError } from 'zod'
import { prisma } from '@/lib/prisma'
import { canManageAsset } from '@/lib/inventory-access'
import { getInventorySessionContext } from '@/lib/inventory/inventory-session'

/**
 * POST /api/inventory/assignments
 * Crea una nueva asignación y genera acta de entrega automáticamente
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo ADMIN y TECHNICIAN pueden crear asignaciones
    if (session.user.role === 'CLIENT') {
      return NextResponse.json(
        { error: 'No tienes permisos para crear asignaciones' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validar datos
    const validatedData = createAssignmentSchema.parse(body)

    const equipmentForScope = await prisma.equipment.findUnique({
      where: { id: validatedData.equipmentId },
      select: {
        status: true,
        type: { select: { familyId: true } },
      },
    })
    if (!equipmentForScope) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const assetFamilyId = equipmentForScope.type?.familyId ?? null
    const allowed = await canManageAsset(
      session.user.id,
      session.user.role,
      isSuperAdmin,
      assetFamilyId
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'No tienes permiso para asignar equipos de esta familia' },
        { status: 403 }
      )
    }

    // Validar que el receptor pertenezca al mismo departamento que el equipo
    const deptValidation = await InventoryDepartmentService.validateAssignmentDepartment(
      validatedData.equipmentId,
      validatedData.receiverId
    )

    if (deptValidation.valid === false) {
      return NextResponse.json(
        {
          error: `El receptor pertenece al departamento '${deptValidation.receiverDeptName}' pero el equipo pertenece al departamento '${deptValidation.requiredDeptName}'`,
        },
        { status: 422 }
      )
    }

    // Crear asignación
    let assignment
    try {
      assignment = await AssignmentService.createAssignment(validatedData, session.user.id)

      // Generar acta de entrega si la familia lo requiere
      let deliveryAct = null
      let acceptanceUrl: string | null = null

      const equipment = await prisma.equipment.findUnique({
        where: { id: validatedData.equipmentId },
        select: { typeId: true },
      })
      const familyConfig = equipment?.typeId
        ? await prisma.inventory_family_config.findFirst({
            where: { family: { equipmentTypes: { some: { id: equipment.typeId } } } },
            select: { requireDeliveryAct: true },
          })
        : null

      if (familyConfig?.requireDeliveryAct !== false) {
        deliveryAct = await DeliveryActService.generateDeliveryAct(assignment.id)
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        acceptanceUrl = `${baseUrl}/acts/${deliveryAct.id}/accept?token=${deliveryAct.acceptanceToken}`
      }

      return NextResponse.json(
        {
          assignment,
          deliveryAct,
          acceptanceUrl,
        },
        { status: 201 }
      )
    } catch (actError) {
      if (assignment) {
        await AssignmentService.rollbackAssignment(assignment.id).catch(err =>
          console.error('[assignments] Error en rollback:', err)
        )
      }
      throw actError
    }
  } catch (error) {
    console.error('Error en POST /api/inventory/assignments:', error)

    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al crear asignación' }, { status: 500 })
  }
}

/**
 * GET /api/inventory/assignments
 * Lista asignaciones con filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const filters: AssignmentFilters = {
      equipmentId: searchParams.get('equipmentId') || undefined,
      receiverId: searchParams.get('receiverId') || undefined,
      delivererId: searchParams.get('delivererId') || undefined,
      isActive:
        searchParams.get('isActive') === 'true'
          ? true
          : searchParams.get('isActive') === 'false'
            ? false
            : undefined,
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const ctx = await getInventorySessionContext(session.user)
    const scopedFilters = { ...filters }

    if (session.user.role === 'CLIENT') {
      scopedFilters.receiverId = session.user.id
    } else if (!ctx.user.isSuperAdmin) {
      if (ctx.scope.noAccess) {
        return NextResponse.json({ assignments: [], total: 0, page, limit })
      }
      if (ctx.scope.familyIds) {
        scopedFilters.scopeFamilyIds = ctx.scope.familyIds
      }
    }

    const result = await AssignmentService.listAssignments(scopedFilters, page, limit)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en GET /api/inventory/assignments:', error)

    return NextResponse.json({ error: 'Error al obtener asignaciones' }, { status: 500 })
  }
}
