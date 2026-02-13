import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

/**
 * Endpoint para convertir un técnico a cliente
 * Valida que no tenga tickets pendientes ni asignaciones activas
 */
export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const params = await context.params
    const userId = params.id

    // Verificar que el usuario existe y es técnico
    const user = await prisma.users.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { success: false, error: 'El usuario no es un técnico' },
        { status: 400 }
      )
    }

    // Contar tickets pendientes
    const pendingTickets = await prisma.tickets.count({
      where: {
        assigneeId: userId,
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      }
    })

    if (pendingTickets > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede convertir a cliente',
          details: {
            reason: 'tickets_pending',
            message: `El técnico tiene ${pendingTickets} ticket(s) pendiente(s). Debe resolver o reasignar todos los tickets antes de convertirlo a cliente.`,
            pendingTickets
          }
        },
        { status: 400 }
      )
    }

    // Contar asignaciones activas
    const activeAssignments = await prisma.technician_assignments.count({
      where: {
        technicianId: userId
      }
    })

    if (activeAssignments > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede convertir a cliente',
          details: {
            reason: 'assignments_active',
            message: `El técnico tiene ${activeAssignments} asignación(es) de categoría(s) activa(s). Debe eliminar todas las asignaciones antes de convertirlo a cliente.`,
            activeAssignments
          }
        },
        { status: 400 }
      )
    }

    // Convertir a cliente
    const updatedUser = await prisma.users.update({
      where: { id: userId },
      data: {
        role: 'CLIENT',
        updatedAt: new Date()
      }
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        action: 'user_demoted',
        entityType: 'User',
        entityId: userId,
        userId: session.user.id,
        details: {
          previousRole: 'TECHNICIAN',
          newRole: 'CLIENT',
          userName: user.name,
          userEmail: user.email
        },
        createdAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: `${user.name} ha sido convertido a cliente exitosamente`,
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role
      }
    })
  } catch (error) {
    console.error('[CRITICAL] Error demoting technician:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al convertir técnico a cliente',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
