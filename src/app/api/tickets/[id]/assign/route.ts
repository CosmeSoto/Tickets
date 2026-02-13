import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const assignmentData = await request.json()

    // Validaciones
    if (assignmentData.assigneeId !== null && typeof assignmentData.assigneeId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'ID del técnico inválido'
        },
        { status: 400 }
      )
    }

    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 300))

    // En producción, actualizar asignación en base de datos y crear entrada en timeline
    const updatedTicket = {
      id: ticketId,
      assigneeId: assignmentData.assigneeId,
      assignee: assignmentData.assigneeId ? {
        id: assignmentData.assigneeId,
        name: 'Técnico Asignado',
        email: 'tecnico@soporte.com',
        role: 'TECHNICIAN'
      } : null,
      updatedAt: new Date().toISOString()
    }

    // También crear entrada en timeline
    const timelineEntry = {
      id: `timeline_${Date.now()}`,
      ticketId,
      type: 'assignment',
      title: assignmentData.assigneeId ? 'Ticket asignado' : 'Asignación removida',
      description: assignmentData.comment || (assignmentData.assigneeId ? 'Ticket asignado a técnico' : 'Se removió la asignación del ticket'),
      user: {
        id: 'current_user',
        name: 'Usuario Actual',
        email: 'usuario@soporte.com',
        role: 'ADMIN'
      },
      metadata: {
        oldValue: 'PREVIOUS_ASSIGNEE', // En producción, obtener el técnico anterior
        newValue: assignmentData.assigneeId ? 'Técnico Asignado' : null
      },
      createdAt: new Date().toISOString(),
      isInternal: false
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket: updatedTicket,
        timelineEntry
      },
      message: assignmentData.assigneeId ? 'Ticket asignado exitosamente' : 'Asignación removida exitosamente'
    })
  } catch (error) {
    console.error('Error in assign PATCH API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar la asignación del ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    
    // Si es asignación automática
    if (mode === 'auto') {
      const body = await request.json()
      
      // Simular lógica de asignación automática
      const bestTechnician = {
        id: 'tech_auto_001',
        name: 'Juan Pérez',
        email: 'juan.perez@soporte.com',
        assignmentReason: 'Seleccionado por menor carga de trabajo y especialización en la categoría'
      }

      // Simular delay de procesamiento
      await new Promise(resolve => setTimeout(resolve, 1000))

      const result = {
        ticket: {
          id: ticketId,
          assigneeId: bestTechnician.id,
          status: 'IN_PROGRESS',
          updatedAt: new Date().toISOString()
        },
        assignedTechnician: bestTechnician,
        reason: 'Asignación automática basada en carga de trabajo y especialización'
      }

      return NextResponse.json(result)
    }

    // Para otros tipos de POST, redirigir a PATCH
    return NextResponse.json(
      { error: 'Método no soportado para este tipo de asignación' },
      { status: 405 }
    )

  } catch (error) {
    console.error('Error in assign POST API:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
