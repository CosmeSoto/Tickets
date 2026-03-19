import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssignmentService } from '@/lib/services/assignment.service'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * PATCH /api/inventory/assignments/[id]
 * Devuelve/completa una asignación activa (genera acta de devolución)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role === 'CLIENT') {
      return NextResponse.json({ error: 'No tienes permisos para devolver equipos' }, { status: 403 })
    }

    const body = await request.json()
    const { returnDate, observations, condition } = body

    if (!returnDate) {
      return NextResponse.json({ error: 'La fecha de devolución es requerida' }, { status: 400 })
    }

    const assignment = await AssignmentService.returnEquipment(
      params.id,
      new Date(returnDate),
      session.user.id,
      observations,
      condition
    )

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error en PATCH /api/inventory/assignments/[id]:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error al devolver equipo' }, { status: 500 })
  }
}

/**
 * GET /api/inventory/assignments/[id]
 * Obtiene detalles de una asignación
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const assignment = await AssignmentService.getAssignmentDetail(params.id)

    if (!assignment) {
      return NextResponse.json(
        { error: 'Asignación no encontrada' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo ADMIN, TECHNICIAN, o los involucrados pueden ver
    const isInvolved = 
      assignment.assignment.receiverId === session.user.id ||
      assignment.assignment.delivererId === session.user.id

    if (session.user.role === 'CLIENT' && !isInvolved) {
      return NextResponse.json(
        { error: 'No tienes permisos para ver esta asignación' },
        { status: 403 }
      )
    }

    return NextResponse.json(assignment)
  } catch (error) {
    console.error('Error en GET /api/inventory/assignments/[id]:', error)
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al obtener asignación' },
      { status: 500 }
    )
  }
}
