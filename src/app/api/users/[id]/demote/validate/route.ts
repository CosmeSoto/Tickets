/**
 * API para validar si un técnico puede ser despromovido a cliente.
 * Usa el mismo guard que el POST /demote para garantizar consistencia.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  UserModuleGuardService,
  ModuleDisableBlockedError,
} from '@/lib/services/user-module-guard.service'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 403 })
    }

    const userId = (await params).id

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    })

    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (user.role !== 'TECHNICIAN') {
      return NextResponse.json(
        { success: false, error: 'Solo los técnicos pueden ser despromovidos a cliente' },
        { status: 400 }
      )
    }

    // Usar el mismo guard que el POST para garantizar consistencia
    try {
      await UserModuleGuardService.assertCanChangeRole({
        userId,
        userName: user.name,
        currentRole: 'TECHNICIAN',
        newRole: 'CLIENT',
      })

      // Sin bloqueadores — puede despromover
      return NextResponse.json({
        success: true,
        canDemote: true,
        blockers: [],
        message: 'El técnico puede ser despromovido a cliente',
      })
    } catch (guardErr) {
      if (guardErr instanceof ModuleDisableBlockedError) {
        const totalCount = guardErr.blockers.reduce((s, b) => s + b.count, 0)
        const moduleNames = [...new Set(guardErr.blockers.map(b => b.module))].join(', ')

        return NextResponse.json({
          success: true,
          canDemote: false,
          blockers: guardErr.blockers,
          // Campos legacy que DemoteTechnicianDialog usa para mostrar la vista antigua
          assignedTickets: totalCount,
          activeAssignments: 0,
          message: `${user.name} tiene ${totalCount} elemento${totalCount !== 1 ? 's' : ''} pendiente${totalCount !== 1 ? 's' : ''} en: ${moduleNames}. Resuélvelos antes de despromover.`,
        })
      }
      throw guardErr
    }
  } catch (error) {
    console.error('[API] Error validando despromoción:', error)
    return NextResponse.json(
      { success: false, error: 'Error al validar la despromoción del técnico' },
      { status: 500 }
    )
  }
}
