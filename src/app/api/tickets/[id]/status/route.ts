import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ticketId } = await params
    const statusData = await request.json()

    // Validaciones
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ON_HOLD']
    if (!statusData.status || !validStatuses.includes(statusData.status)) {
      return NextResponse.json(
        {
          success: false,
          message: 'Estado de ticket inválido. Debe ser uno de: ' + validStatuses.join(', ')
        },
        { status: 400 }
      )
    }

    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 300))

    // En producción, actualizar estado en base de datos y crear entrada en timeline
    const updatedTicket = {
      id: ticketId,
      status: statusData.status,
      updatedAt: new Date().toISOString(),
      // Si se resuelve, agregar timestamp correspondiente
      ...(statusData.status === 'RESOLVED' && { resolvedAt: new Date().toISOString() })
    }

    // También crear entrada en timeline
    const timelineEntry = {
      id: `timeline_${Date.now()}`,
      ticketId,
      type: 'status_change',
      title: 'Estado actualizado',
      description: statusData.comment || `Estado cambiado a ${statusData.status}`,
      user: {
        id: 'current_user',
        name: 'Usuario Actual',
        email: 'usuario@soporte.com',
        role: 'TECHNICIAN'
      },
      metadata: {
        oldValue: 'PREVIOUS_STATUS', // En producción, obtener el estado anterior
        newValue: statusData.status
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
      message: 'Estado del ticket actualizado exitosamente'
    })
  } catch (error) {
    console.error('Error in status PATCH API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar el estado del ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}