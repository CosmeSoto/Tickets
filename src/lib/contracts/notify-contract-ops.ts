import prisma from '@/lib/prisma'
import { NotificationService } from '@/lib/services/notification-service'
import {
  getFamilyScopedAdmins,
  getAreaEmailRecipients,
} from '@/lib/notifications/family-recipients'
import { queueNotificationEmail } from '@/lib/notifications/queue-notification-email'
import { queueTelegramNotification } from '@/lib/notifications/queue-notification-telegram'
import { getSystemBranding } from '@/lib/branding'

export type ContractOpsNotifyInput = {
  familyId?: string | null
  extraUserIds?: Array<string | null | undefined>
  title: string
  message: string
  html?: string
  link: string
  metadata?: Record<string, unknown>
  /** Si false, solo in-app (p. ej. gobernanza de datos incompletos). */
  channels?: { email?: boolean; telegram?: boolean }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function toHtml(title: string, message: string, link: string, systemName: string) {
  const appUrl = process.env.NEXTAUTH_URL || ''
  const href = link.startsWith('http') ? link : `${appUrl}${link}`
  const body = escapeHtml(message).replace(/\n/g, '<br/>')
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#333">
  <h2>${escapeHtml(title)}</h2>
  <p>${body}</p>
  <p><a href="${href}">Abrir en ${escapeHtml(systemName)}</a></p>
  </body></html>`
}

/**
 * Destinatarios in-app y Telegram: super admins + admin nativo del área + custodios.
 * El superadmin recibe estas alertas por push, no por email (evitar ruido).
 */
export async function resolveContractOpsRecipients(params: {
  familyId?: string | null
  extraUserIds?: Array<string | null | undefined>
}) {
  const admins = await getFamilyScopedAdmins(params.familyId, {
    id: true,
    name: true,
    email: true,
  })
  const extraIds = [...new Set((params.extraUserIds ?? []).filter((id): id is string => !!id))]
  const extra =
    extraIds.length === 0
      ? []
      : await prisma.users.findMany({
          where: { id: { in: extraIds }, isActive: true },
          select: { id: true, name: true, email: true },
        })
  const seen = new Set<string>()
  const out: Array<{ id: string; name: string | null; email: string | null }> = []
  for (const u of [...admins, ...extra]) {
    if (seen.has(u.id)) continue
    seen.add(u.id)
    out.push({ id: u.id, name: u.name ?? null, email: u.email ?? null })
  }
  return out
}

export async function notifyContractOps(input: ContractOpsNotifyInput) {
  // ── Destinatarios in-app/Telegram: superadmin + admin nativo + custodios ──
  const pushRecipients = await resolveContractOpsRecipients({
    familyId: input.familyId,
    extraUserIds: input.extraUserIds,
  })
  if (pushRecipients.length === 0) return 0

  const emailOn = input.channels?.email !== false
  const telegramOn = input.channels?.telegram !== false
  const { systemName } = await getSystemBranding()
  const html = input.html ?? toHtml(input.title, input.message, input.link, systemName)

  // ── In-app: todos (incluye superadmin) ────────────────────────────────────
  for (const user of pushRecipients) {
    await NotificationService.push({
      userId: user.id,
      type: 'INVENTORY',
      title: input.title,
      message: input.message,
      metadata: { ...input.metadata, link: input.link },
    }).catch(() => {})
  }

  // ── Email: solo admin nativo del área + custodios (sin superadmin) ─────────
  if (emailOn) {
    const emailRecipients = await getAreaEmailRecipients(input.familyId, {
      extraUserIds: input.extraUserIds,
    })
    for (const user of emailRecipients) {
      if (!user.email) continue
      await queueNotificationEmail({
        to: user.email,
        subject: input.title,
        html,
        recipientUserId: user.id,
        module: 'inventory',
        event: 'inventoryAlert',
        priority: 'important',
      }).catch(() => {})
    }
  }

  // ── Telegram: todos (incluye superadmin) ──────────────────────────────────
  if (telegramOn) {
    await queueTelegramNotification({
      recipients: pushRecipients.map(r => ({ userId: r.id })),
      title: input.title,
      body: input.message,
      module: 'inventory',
      event: 'inventoryAlert',
      link: input.link,
    }).catch(() => {})
  }

  return pushRecipients.length
}
