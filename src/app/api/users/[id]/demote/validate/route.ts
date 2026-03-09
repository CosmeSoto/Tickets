/**
 * API para validar si un técnico puede ser despromovido a cliente
 * Verifica que no tenga tickets asignados pendientes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo admins pueden validar despromociones
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const userId = (await params).id

    // Verificar que el usuario existe y es técnico
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Solo los técnicos pueden ser despromovidos a cliente' 
        },
        { status: 400 }
      )
    }

    // Contar tickets asignados pendientes
    const assignedTickets = await prisma.tickets.count({
      where: {
        assigneeId: userId,
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      }
    })

    // Contar asignaciones de categorías activas
    const activeAssignments = await prisma.technician_assignments.count({
      where: {
        technicianId: userId,
        isActive: true
      }
    })

    const canDemote = assignedTickets === 0 && activeAssignments === 0

    let message = ''
    if (canDemote) {
      message = 'El técnico puede ser despromovido a cliente'
    } else {
      const issues = []
      if (assignedTickets > 0) {
        issues.push(`${assignedTickets} ticket(s) asignado(s) pendiente(s)`)
      }
      if (activeAssignments > 0) {
        issues.push(`${activeAssignments} asignación(es) de categoría(s) activa(s)`)
      }
      message = `El técnico tiene ${issues.join(' y ')}. Debe resolver o reasignar todos los tickets y eliminar las asignaciones antes de ser despromovido.`
    }

    return NextResponse.json({
      success: true,
      canDemote,
      assignedTickets,
      activeAssignments,
      message
    })
  } catch (error) {
    console.error('[API] Error validando despromoción:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al validar la despromoción del técnico' 
      },
      { status: 500 }
    )
  }
}
