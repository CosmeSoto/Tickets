/**
 * GET  /api/admin/settings/email-queue  — estado de la cola (pendientes, fallidos, recientes)
 * POST /api/admin/settings/email-queue  — procesar cola ahora + opción de reintentar fallidos
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EmailService } from '@/lib/services/email/email-service'
import prisma from '@/lib/prisma'

async function requireSuperAdmin(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return { ok: false, status: 401, error: 'No autorizado' } as const
  }
  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  if (!user?.isSuperAdmin) return { ok: false, status: 403, error: 'Requiere Super Admin' } as const
  return { ok: true } as const
}

export async function GET(request: NextRequest) {
  try {
    const check = await requireSuperAdmin(request)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100)

    const [pending, failed, recentSent, recentFailed] = await Promise.all([
      prisma.email_queue.count({ where: { status: 'pending' } }),
      prisma.email_queue.count({ where: { status: 'failed' } }),
      prisma.email_queue.findMany({
        where: { status: 'sent' },
        orderBy: { sentAt: 'desc' },
        take: limit,
        select: {
          id: true,
          toEmail: true,
          subject: true,
          sentAt: true,
          attempts: true,
        },
      }),
      prisma.email_queue.findMany({
        where: { status: 'failed' },
        orderBy: { scheduledAt: 'desc' },
        take: limit,
        select: {
          id: true,
          toEmail: true,
          subject: true,
          scheduledAt: true,
          attempts: true,
          maxAttempts: true,
          errorMessage: true,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      stats: { pending, failed },
      recentSent,
      recentFailed,
    })
  } catch (error) {
    console.error('[EMAIL-QUEUE API] GET error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const check = await requireSuperAdmin(request)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status })

    const body = await request.json().catch(() => ({}))
    const retryFailed = body?.retryFailed === true

    // Si se pidió reintentar fallidos, resetearlos a pending primero
    let resetCount = 0
    if (retryFailed) {
      const result = await prisma.email_queue.updateMany({
        where: { status: 'failed' },
        data: { status: 'pending', attempts: 0, errorMessage: null },
      })
      resetCount = result.count
    }

    const result = await EmailService.processQueue()

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      retriedReset: resetCount,
      message:
        result.sent === 0 && resetCount === 0
          ? 'No había emails pendientes en la cola'
          : `${result.sent} enviados, ${result.failed} fallidos${resetCount ? `, ${resetCount} fallidos reintentados` : ''}`,
    })
  } catch (error) {
    console.error('[EMAIL-QUEUE API] POST error:', error)
    return NextResponse.json({ error: 'Error interno al procesar la cola' }, { status: 500 })
  }
}
