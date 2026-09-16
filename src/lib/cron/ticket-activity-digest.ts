/**
 * Vacía la cola de digest de actividad de tickets (comentarios, actualizaciones
 * menores) en un solo correo por (ticket, destinatario) — ver
 * src/lib/notifications/queue-ticket-digest-item.ts para el encolado.
 *
 * El intervalo real es configurable desde Admin → Configuración → Tickets
 * (`ticketDigestIntervalMinutes`, default 30 min). El cron del servidor puede
 * (y conviene que) corra más seguido que ese intervalo — este módulo lleva su
 * propio throttle vía `ticketDigest.lastRunAt` en `system_settings`, igual
 * que el patrón de `lastWeeklyDigestAt` en weekly-notification-digest.ts, así
 * que una corrida "de más" simplemente no hace nada (consulta barata, sin
 * tocar la tabla de items).
 */

import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { buildOperationalEmail } from '@/lib/services/email/operational-email'
import { getEmailBranding } from '@/lib/services/email/email-branding'
import { escapeHtml } from '@/lib/services/email/email-layout'

export interface TicketActivityDigestResult {
  groups: number
  sent: number
  errors: number
  skipped?: boolean
}

const INTERVAL_SETTING_KEY = 'ticketDigestIntervalMinutes'
const LAST_RUN_SETTING_KEY = 'ticketDigest.lastRunAt'
const DEFAULT_INTERVAL_MINUTES = 30

function portalPrefix(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'admin'
    case 'TECHNICIAN':
      return 'technician'
    default:
      return 'client'
  }
}

async function isDigestDue(): Promise<boolean> {
  const rows = await prisma.system_settings.findMany({
    where: { key: { in: [INTERVAL_SETTING_KEY, LAST_RUN_SETTING_KEY] } },
  })
  const intervalRaw = rows.find(r => r.key === INTERVAL_SETTING_KEY)?.value
  const lastRunRaw = rows.find(r => r.key === LAST_RUN_SETTING_KEY)?.value

  const intervalMinutes = Math.max(1, parseInt(intervalRaw || '', 10) || DEFAULT_INTERVAL_MINUTES)
  if (!lastRunRaw) return true

  const lastRun = new Date(lastRunRaw).getTime()
  if (!Number.isFinite(lastRun)) return true

  return Date.now() - lastRun >= intervalMinutes * 60 * 1000
}

async function markDigestRun(): Promise<void> {
  await prisma.system_settings.upsert({
    where: { key: LAST_RUN_SETTING_KEY },
    update: { value: new Date().toISOString(), updatedAt: new Date() },
    create: {
      id: randomUUID(),
      key: LAST_RUN_SETTING_KEY,
      value: new Date().toISOString(),
      description: 'Última corrida real del digest de actividad de tickets (throttle interno)',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

export async function runTicketActivityDigest(): Promise<TicketActivityDigestResult> {
  if (!(await isDigestDue())) {
    return { groups: 0, sent: 0, errors: 0, skipped: true }
  }

  const items = await prisma.ticket_email_digest_items.findMany({
    orderBy: { createdAt: 'asc' },
    take: 2000,
  })

  if (items.length === 0) {
    await markDigestRun()
    return { groups: 0, sent: 0, errors: 0 }
  }

  const groups = new Map<string, typeof items>()
  for (const item of items) {
    const key = `${item.recipientId}::${item.ticketId}`
    const list = groups.get(key)
    if (list) {
      list.push(item)
    } else {
      groups.set(key, [item])
    }
  }

  const branding = await getEmailBranding().catch(() => null)
  const baseUrl = (
    branding?.baseUrl ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '')

  let sent = 0
  let errors = 0

  for (const [key, groupItems] of groups) {
    const [recipientId, ticketId] = key.split('::')
    const itemIds = groupItems.map(i => i.id)

    try {
      const [recipient, ticket] = await Promise.all([
        prisma.users.findUnique({
          where: { id: recipientId },
          select: { id: true, name: true, email: true, role: true },
        }),
        prisma.tickets.findUnique({
          where: { id: ticketId },
          select: { id: true, title: true, ticketCode: true },
        }),
      ])

      if (!recipient?.email || !ticket) {
        await prisma.ticket_email_digest_items.deleteMany({ where: { id: { in: itemIds } } })
        continue
      }

      const code = ticket.ticketCode || ticket.id.substring(0, 8)
      const visible = groupItems.slice(0, 5)
      const extra = groupItems.length - visible.length
      const itemsHtml = visible
        .map(i => `<li style="margin:0 0 6px;">${escapeHtml(i.summary)}</li>`)
        .join('')
      const extraHtml = extra > 0 ? `<li style="margin:0 0 6px;">y ${extra} más…</li>` : ''
      const prefix = portalPrefix(recipient.role)

      const { html, text } = await buildOperationalEmail({
        headline: 'Novedades en tu ticket',
        preheader: `${groupItems.length} novedad(es) en el ticket #${code}.`,
        greetingName: recipient.name,
        introHtml: `<p style="margin:0 0 8px;">Hay novedades en el ticket <strong>#${code}</strong> — ${escapeHtml(ticket.title)}:</p><ul style="margin:0 0 12px;padding-left:20px;">${itemsHtml}${extraHtml}</ul>`,
        cta: { href: `${baseUrl}/${prefix}/tickets/${ticket.id}`, label: 'Ver ticket' },
      })

      const { sent: sentCount } = await queueNotificationEmail({
        to: recipient.email,
        recipientUserId: recipient.id,
        subject: `Novedades — Ticket #${code}`,
        html,
        text,
        module: 'tickets',
        event: 'newComments',
      })

      if (sentCount > 0) sent++

      await prisma.ticket_email_digest_items.deleteMany({ where: { id: { in: itemIds } } })
    } catch (err) {
      errors++
      console.error(`[ticket-activity-digest] Error para grupo ${key}:`, err)
    }
  }

  await markDigestRun()

  return { groups: groups.size, sent, errors }
}
