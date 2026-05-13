/**
 * GET /api/patrols/checkpoints/[id]/qr-display
 * Obtiene el QR actual para visualización en pantalla pública.
 * Solo para checkpoints activos con QR DINÁMICO.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { PatrolQRService } from '@/lib/services/patrol-qr.service'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const checkpoint = await prisma.patrol_checkpoints.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
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
