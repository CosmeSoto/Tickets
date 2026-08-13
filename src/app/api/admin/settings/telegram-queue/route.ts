/**
 * GET  /api/admin/settings/telegram-queue — estado de la cola (pendientes, fallidos, recientes)
 * POST /api/admin/settings/telegram-queue — procesar cola ahora + opción de reintentar fallidos
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'
import {
  processTelegramQueue,
  purgeOldTelegramQueueRows,
} from '@/lib/services/telegram-queue.service'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const check = await requireSuperAdmin(session)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

    const [pending, failed, sending, recentSent, recentFailed] = await Promise.all([
      prisma.telegram_queue.count({ where: { status: 'pending' } }),
      prisma.telegram_queue.count({ where: { status: 'failed' } }),
      prisma.telegram_queue.count({ where: { status: 'sending' } }),
      prisma.telegram_queue.findMany({
        where: { status: 'sent' },
        orderBy: { sentAt: 'desc' },
        take: limit,
        select: {
          id: true,
          chatId: true,
          title: true,
          module: true,
          priority: true,
          sentAt: true,
          attempts: true,
        },
      }),
      prisma.telegram_queue.findMany({
        where: { status: 'failed' },
        orderBy: { scheduledAt: 'desc' },
        take: limit,
        select: {
          id: true,
          chatId: true,
          title: true,
          module: true,
          priority: true,
          scheduledAt: true,
          attempts: true,
          maxAttempts: true,
          errorMessage: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      stats: { pending, failed, sending },
      recentSent,
      recentFailed,
    })
  } catch (error) {
    console.error('[TELEGRAM-QUEUE API] GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const check = await requireSuperAdmin(session)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    const body = await request.json().catch(() => ({}))
    const retryFailed = body?.retryFailed === true
    const purgeOld = body?.purgeOld === true

    let resetCount = 0
    if (retryFailed) {
      const result = await prisma.telegram_queue.updateMany({
        where: { status: 'failed' },
        data: {
          status: 'pending',
          attempts: 0,
          errorMessage: null,
          scheduledAt: new Date(),
        },
      })
      resetCount = result.count
    }

    const result = await processTelegramQueue()
    const purged = purgeOld ? await purgeOldTelegramQueueRows(7) : 0

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      retriedReset: resetCount,
      purged,
      message:
        result.sent === 0 && resetCount === 0
          ? 'No había alertas pendientes en la cola'
          : `${result.sent} enviadas, ${result.failed} fallidas${resetCount ? `, ${resetCount} reencoladas` : ''}${purged ? `, ${purged} antiguas purgadas` : ''}`,
    })
  } catch (error) {
    console.error('[TELEGRAM-QUEUE API] POST error:', error)
    return NextResponse.json({ error: 'Error interno al procesar la cola' }, { status: 500 })
  }
}
