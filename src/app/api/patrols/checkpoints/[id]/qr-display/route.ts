/**
 * GET /api/patrols/checkpoints/[id]/qr-display
 * Obtiene el QR actual para visualización en pantalla.
 * Solo para checkpoints activos con QR DINÁMICO.
 * Requiere sesión ADMIN/TECH con acceso operational a la familia.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PatrolQRService } from '@/lib/services/patrol-qr.service'
import { checkPatrolFamilyOperate } from '@/lib/patrol/patrol-access'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!['ADMIN', 'TECHNICIAN'].includes(session.user.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params

    const checkpoint = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        familyId: true,
        qrType: true,
        qrSecret: true,
        isActive: true,
        family: {
          select: {
            patrolFamilyConfig: {
              select: {
                qrWindowMinutes: true,
              },
            },
          },
        },
      },
    })

    if (!checkpoint)
      return NextResponse.json({ error: 'Checkpoint no encontrado' }, { status: 404 })

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      checkpoint.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    if (!checkpoint.isActive)
      return NextResponse.json({ error: 'Checkpoint inactivo' }, { status: 409 })

    if (checkpoint.qrType !== 'DYNAMIC')
      return NextResponse.json({ error: 'Solo disponible para QR dinámico' }, { status: 400 })

    const qrWindowMinutes = checkpoint.family?.patrolFamilyConfig?.qrWindowMinutes ?? 5
    const windowIndex = Math.floor(Date.now() / 1000 / (qrWindowMinutes * 60))
    const token = PatrolQRService.generateToken(checkpoint.qrSecret, windowIndex)
    const pngBuffer = await PatrolQRService.generateQRImage(checkpoint.id, token)

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (error) {
    console.error('[patrol/checkpoints/[id]/qr-display] GET:', error)
    return NextResponse.json({ error: 'Error generando QR' }, { status: 500 })
  }
}
