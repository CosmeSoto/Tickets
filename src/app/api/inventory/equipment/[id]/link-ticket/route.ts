import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const linkTicketSchema = z.object({
  ticketId: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ticketId } = linkTicketSchema.parse(body)
    const equipmentId = params.id

    // Verificar que el equipo existe
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: {
        currentAssignment: true
      }
    })

    if (!equipment) {
      return NextResponse.json(
        { error: 'Equipo no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el ticket existe y pertenece al usuario
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId }
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    if (ticket.clientId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    // Crear registro de mantenimiento vinculado al ticket
    await prisma.maintenance_records.create({
      data: {
        id: crypto.randomUUID(),
        equipmentId,
        type: 'CORRECTIVE',
        description: `Problema reportado por usuario: ${ticket.title}`,
        date: new Date(),
        technicianId: equipment.currentAssignment?.delivererId || session.user.id,
        ticketId,
        status: 'PENDING',
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Ticket vinculado con equipo exitosamente'
    })
  } catch (error) {
    console.error('Error vinculando ticket con equipo:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
