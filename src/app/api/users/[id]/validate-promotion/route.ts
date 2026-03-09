/**
 * API para validar si un usuario puede ser promovido a técnico
 * Verifica que no tenga tickets pendientes
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
    console.log('[API-VALIDATE-PROMOTION] Iniciando validación')
    
    const session = await getServerSession(authOptions)

    if (!session) {
      console.log('[API-VALIDATE-PROMOTION] Sin sesión')
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Solo admins pueden validar promociones
    if (session.user.role !== 'ADMIN') {
      console.log('[API-VALIDATE-PROMOTION] Usuario no es admin:', session.user.role)
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 403 }
      )
    }

    const userId = (await params).id
    console.log('[API-VALIDATE-PROMOTION] Validando usuario:', userId)

    // Verificar que el usuario existe y es cliente
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    })

    console.log('[API-VALIDATE-PROMOTION] Usuario encontrado:', user ? user.email : 'null')

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    if (user.role !== 'CLIENT') {
      console.log('[API-VALIDATE-PROMOTION] Usuario no es cliente:', user.role)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Solo los usuarios con rol de cliente pueden ser promovidos a técnico' 
        },
        { status: 400 }
      )
    }

    console.log('[API-VALIDATE-PROMOTION] Contando tickets pendientes...')
    
    // Contar tickets pendientes del cliente (OPEN o IN_PROGRESS)
    const pendingTickets = await prisma.tickets.count({
      where: {
        clientId: userId,
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      }
    })

    console.log('[API-VALIDATE-PROMOTION] Tickets pendientes:', pendingTickets)

    const canPromote = pendingTickets === 0

    return NextResponse.json({
      success: true,
      data: {
        canPromote,
        pendingTickets,
        message: canPromote
          ? 'El usuario puede ser promovido a técnico'
          : `El usuario tiene ${pendingTickets} ticket(s) pendiente(s). Debe cerrar o reasignar todos sus tickets antes de ser promovido.`
      }
    })
  } catch (error) {
    console.error('[API-VALIDATE-PROMOTION] Error completo:', error)
    console.error('[API-VALIDATE-PROMOTION] Stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al validar la promoción del usuario',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
