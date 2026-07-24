/**
 * GET /api/patrols/checkpoints/[id]/qr
 * Genera imagen PNG del QR para impresión física.
 * Solo ADMIN. qrSecret NUNCA se expone en la respuesta.
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
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Solo administradores pueden descargar QR' },
        { status: 403 }
      )
    }

    const { id } = await params
    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true

    // Obtener checkpoint con qrSecret (solo para uso interno — nunca se devuelve)
    const checkpoint = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: {
        id: true,
        familyId: true,
        name: true,
        qrType: true,
        qrSecret: true, // Solo para generar el token — NUNCA en la respuesta
        qrStaticToken: true, // Solo para QR estático — NUNCA en la respuesta
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
    if (!checkpoint.isActive)
      return NextResponse.json({ error: 'Checkpoint inactivo' }, { status: 409 })

    const hasAccess = await checkPatrolFamilyOperate(
      session.user.id,
      checkpoint.familyId,
      session.user.role,
      isSuperAdmin
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'No tienes acceso a esta área' }, { status: 403 })
    }

    // Generar token según tipo de QR
    let token: string
    if (checkpoint.qrType === 'STATIC') {
      // Token estático fijo
      token = checkpoint.qrStaticToken!
    } else {
      // Token dinámico para la ventana actual (usar configuración de la familia)
      const qrWindowMinutes = checkpoint.family?.patrolFamilyConfig?.qrWindowMinutes ?? 5
      const windowIndex = Math.floor(Date.now() / 1000 / (qrWindowMinutes * 60))
      token = PatrolQRService.generateToken(checkpoint.qrSecret, windowIndex)
    }

    // Generar imagen PNG — el token se codifica en el QR, no se expone en la respuesta HTTP
    const pngBuffer = await PatrolQRService.generateQRImage(checkpoint.id, token, checkpoint.name)

    const safeName = checkpoint.name.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50)

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="qr-${safeName}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[patrol/checkpoints/[id]/qr] GET:', error)
    return NextResponse.json({ error: 'Error generando QR' }, { status: 500 })
  }
}
