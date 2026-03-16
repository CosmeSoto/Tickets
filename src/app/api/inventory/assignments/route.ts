import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssignmentService } from '@/lib/services/assignment.service'
import { DeliveryActService } from '@/lib/services/delivery-act.service'
import { createAssignmentSchema } from '@/lib/validations/inventory/assignment'
import { ZodError } from 'zod'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * POST /api/inventory/assignments
 * Crea una nueva asignación y genera acta de entrega automáticamente
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
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

    // Crear asignación
    const assignment = await AssignmentService.createAssignment(
      validatedData,
      session.user.id
    )

    // Generar acta de entrega automáticamente
    const deliveryAct = await DeliveryActService.generateDeliveryAct(assignment.id)

    // Construir URL de aceptación
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const acceptanceUrl = `${baseUrl}/acts/${deliveryAct.id}/accept?token=${deliveryAct.acceptanceToken}`

    // Registrar en auditoría
    await AuditServiceComplete.log({
      action: AuditActionsComplete.ASSIGNMENT_CREATED,
      entityType: 'equipment',
      entityId: validatedData.equipmentId,
      userId: session.user.id,
      details: {
        assignmentId: assignment.id,
        receiverId: validatedData.receiverId,
        type: validatedData.type,
        actFolio: deliveryAct.folio,
      },
    })

    return NextResponse.json({
      assignment,
      deliveryAct,
      acceptanceUrl,
    }, { status: 201 })
  } catch (error) {
    console.error('Error en POST /api/inventory/assignments:', error)
    
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al crear asignación' },
      { status: 500 }
    )
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
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const filters = {
      equipmentId: searchParams.get('equipmentId') || undefined,
      receiverId: searchParams.get('receiverId') || undefined,
      delivererId: searchParams.get('delivererId') || undefined,
      isActive: searchParams.get('isActive') === 'true' ? true : 
                searchParams.get('isActive') === 'false' ? false : undefined,
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const result = await AssignmentService.listAssignments(filters, page, limit)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en GET /api/inventory/assignments:', error)
    
    return NextResponse.json(
      { error: 'Error al obtener asignaciones' },
      { status: 500 }
    )
  }
}
