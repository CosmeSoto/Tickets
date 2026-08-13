/**
 * Digest semanal por email para usuarios con weeklyReport + emailNotifications.
 * Idempotente vía user_settings.lastWeeklyDigestAt (una vez por semana ISO).
 */

import prisma from '@/lib/prisma'
import { enqueueEmail } from '@/lib/api/notify'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { getAppTimezone } from '@/lib/utils/date-utils'
import weeklyDigestTemplate from '@/lib/services/email/templates/weekly-digest'

export interface WeeklyDigestResult {
  candidates: number
  sent: number
  skipped: number
  errors: number
}

function startOfWeek(date: Date, timeZone: string): Date {
  // Lunes 00:00 en zona del sistema (aprox. con offset local del formatter)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date)

  const y = Number(parts.find(p => p.type === 'year')?.value)
  const m = Number(parts.find(p => p.type === 'month')?.value)
  const d = Number(parts.find(p => p.type === 'day')?.value)
  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  const offsetDays = map[weekday] ?? 0
  const localMidnight = new Date(Date.UTC(y, m - 1, d))
  localMidnight.setUTCDate(localMidnight.getUTCDate() - offsetDays)
  return localMidnight
}

function isoWeekKey(date: Date): string {
  // YYYY-Www
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function roleLabel(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Administrador'
    case 'TECHNICIAN':
      return 'Técnico'
    case 'CLIENT':
      return 'Cliente'
    default:
      return role
  }
}

function rolePrefix(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'admin'
    case 'TECHNICIAN':
      return 'technician'
    default:
      return 'client'
  }
}

async function buildStatsForUser(user: {
  id: string
  role: string
  name: string
}): Promise<{ stats: { label: string; value: number | string }[]; highlights: string[] }> {
  const tz = getAppTimezone()
  const weekStart = startOfWeek(new Date(), tz)
  const highlights: string[] = []

  const unread = await prisma.notifications.count({
    where: {
      userId: user.id,
      isRead: false,
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: new Date() } }],
    },
  })

  if (user.role === 'CLIENT') {
    const [openTickets, resolvedWeek, createdWeek] = await Promise.all([
      prisma.tickets.count({
        where: {
          clientId: user.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      prisma.tickets.count({
        where: {
          clientId: user.id,
          status: 'RESOLVED',
          updatedAt: { gte: weekStart },
        },
      }),
      prisma.tickets.count({
        where: { clientId: user.id, createdAt: { gte: weekStart } },
      }),
    ])

    if (openTickets > 0) highlights.push(`Tienes ${openTickets} ticket(s) abiertos.`)
    if (resolvedWeek > 0) highlights.push(`${resolvedWeek} ticket(s) fueron resueltos esta semana.`)
    if (unread > 0) highlights.push(`Hay ${unread} notificación(es) sin leer.`)

    return {
      stats: [
        { label: 'Tickets abiertos', value: openTickets },
        { label: 'Creados esta semana', value: createdWeek },
        { label: 'Resueltos esta semana', value: resolvedWeek },
        { label: 'Notificaciones sin leer', value: unread },
      ],
      highlights,
    }
  }

  if (user.role === 'TECHNICIAN') {
    const [assignedOpen, resolvedWeek, commentsWeek] = await Promise.all([
      prisma.tickets.count({
        where: {
          assigneeId: user.id,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
      }),
      prisma.tickets.count({
        where: {
          assigneeId: user.id,
          status: 'RESOLVED',
          updatedAt: { gte: weekStart },
        },
      }),
      prisma.comments.count({
        where: {
          createdAt: { gte: weekStart },
          tickets: { assigneeId: user.id },
        },
      }),
    ])

    if (assignedOpen > 0) highlights.push(`Tienes ${assignedOpen} ticket(s) asignados abiertos.`)
    if (resolvedWeek > 0) highlights.push(`Resolviste ${resolvedWeek} ticket(s) esta semana.`)
    if (unread > 0) highlights.push(`${unread} notificación(es) pendientes de lectura.`)

    return {
      stats: [
        { label: 'Asignados abiertos', value: assignedOpen },
        { label: 'Resueltos esta semana', value: resolvedWeek },
        { label: 'Comentarios en tus tickets', value: commentsWeek },
        { label: 'Notificaciones sin leer', value: unread },
      ],
      highlights,
    }
  }

  // ADMIN
  const [openTickets, createdWeek, resolvedWeek, patrolMissed] = await Promise.all([
    prisma.tickets.count({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),
    prisma.tickets.count({ where: { createdAt: { gte: weekStart } } }),
    prisma.tickets.count({
      where: { status: 'RESOLVED', updatedAt: { gte: weekStart } },
    }),
    prisma.notifications.count({
      where: {
        userId: user.id,
        type: { in: ['PATROL_MISSED', 'PATROL_INCOMPLETE'] },
        createdAt: { gte: weekStart },
      },
    }),
  ])

  if (createdWeek > 0) highlights.push(`${createdWeek} ticket(s) nuevos esta semana.`)
  if (resolvedWeek > 0) highlights.push(`${resolvedWeek} ticket(s) resueltos esta semana.`)
  if (patrolMissed > 0) highlights.push(`${patrolMissed} alerta(s) de rondas esta semana.`)
  if (unread > 0) highlights.push(`${unread} notificación(es) sin leer.`)

  return {
    stats: [
      { label: 'Tickets abiertos (sistema)', value: openTickets },
      { label: 'Creados esta semana', value: createdWeek },
      { label: 'Resueltos esta semana', value: resolvedWeek },
      { label: 'Alertas de rondas', value: patrolMissed },
      { label: 'Notificaciones sin leer', value: unread },
    ],
    highlights,
  }
}

function alreadySentThisWeek(last: Date | null | undefined, weekKey: string): boolean {
  if (!last) return false
  return isoWeekKey(last) === weekKey
}

/**
 * Encola digests semanales. Seguro llamar a diario: solo envía 1x por semana ISO.
 */
export async function runWeeklyNotificationDigest(): Promise<WeeklyDigestResult> {
  const weekKey = isoWeekKey(new Date())
  const branding = await getEmailBranding().catch(() => ({
    systemName: 'Sistema',
    heroTitle: '',
    companyName: 'Sistema',
    logoUrl: null,
    primaryColor: '#EAB308',
    baseUrl: (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, ''),
    privacyUrl: '/help/privacy',
    termsUrl: '/help/terms',
    loginUrl: '/login',
  }))
  const baseUrl = branding.baseUrl

  const users = await prisma.users.findMany({
    where: {
      isActive: true,
      email: { not: '' },
      user_settings: {
        weeklyReport: true,
        emailNotifications: true,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      user_settings: {
        select: { lastWeeklyDigestAt: true },
      },
    },
    take: 500,
  })

  let sent = 0
  let skipped = 0
  let errors = 0

  const periodLabel = `Semana ${weekKey}`

  for (const user of users) {
    if (!user.email) {
      skipped++
      continue
    }
    if (alreadySentThisWeek(user.user_settings?.lastWeeklyDigestAt, weekKey)) {
      skipped++
      continue
    }

    try {
      const { stats, highlights } = await buildStatsForUser(user)
      const prefix = rolePrefix(user.role)
      const { html, text } = weeklyDigestTemplate({
        ...branding,
        userName: user.name || user.email,
        roleLabel: roleLabel(user.role),
        periodLabel,
        dashboardUrl: `${baseUrl}/${prefix}`,
        notificationsUrl: `${baseUrl}/${prefix}/notifications`,
        stats,
        highlights,
      })

      await enqueueEmail({
        to: user.email,
        subject: `[${branding.systemName}] Resumen semanal · ${periodLabel}`,
        html,
        text,
        recipientUserId: user.id,
        module: 'system',
        event: 'digest',
        priority: 'optional',
      })

      await prisma.user_settings.update({
        where: { userId: user.id },
        data: { lastWeeklyDigestAt: new Date(), updatedAt: new Date() },
      })

      sent++
    } catch (err) {
      errors++
      console.error(`[weekly-digest] Error para ${user.id}:`, err)
    }
  }

  return { candidates: users.length, sent, skipped, errors }
}
