/**
 * processUpdate — lógica central de comandos del bot de Telegram.
 *
 * Compartido entre webhook (producción) y cron de polling (local).
 * Añadir un comando aquí lo hace disponible en ambos modos.
 *
 * Comandos por módulo y rol:
 *   Todos               /start /vincular /desvincular /estado /ayuda /catalogo
 *   ticketsEnabled      /mis_tickets  (clientes también /mi_tecnico)
 *   ADMIN/TECH          /pendientes
 *   ADMIN               /actas /sistema
 *   patrolsEnabled      /mis_rondas
 *   inventoryEnabled    /mis_equipos
 *   newsEnabled         /noticias
 *   contratos           /mis_contratos
 */

import { getUserFamilyScope } from '@/lib/auth/admin-scope'
import {
  checkTelegramVincularRateLimit,
  resetTelegramVincularRateLimit,
} from '@/lib/telegram/vincular-rate-limit'
import prisma from '@/lib/prisma'
import { sendTelegramMessage, escapeMdV2 } from '@/lib/services/telegram.service'
import { DecommissionStatus, MaintenanceStatus, TicketStatus } from '@prisma/client'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TelegramUpdateMessage {
  update_id: number
  message?: {
    message_id: number
    from?: { id: number; first_name: string; username?: string }
    chat: { id: number; type: string }
    text?: string
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function processUpdate(update: TelegramUpdateMessage): Promise<void> {
  const message = update.message
  if (!message?.text || !message.from) return

  const chatId = String(message.chat.id)
  const text = message.text.trim()
  const fromId = message.from.id
  const firstName = message.from.first_name ?? 'usuario'

  try {
    if (text.startsWith('/start')) await handleStart(chatId, firstName)
    else if (text.startsWith('/vincular'))
      await handleVincular(chatId, fromId, firstName, text.split(/\s+/)[1] ?? '')
    else if (text.startsWith('/desvincular')) await handleDesvincular(chatId)
    else if (text.startsWith('/estado')) await handleEstado(chatId)
    else if (text.startsWith('/mis_tickets')) await handleMisTickets(chatId)
    else if (text.startsWith('/mi_tecnico')) await handleMiTecnico(chatId)
    else if (text.startsWith('/pendientes')) await handlePendientes(chatId)
    else if (text.startsWith('/actas')) await handleActas(chatId)
    else if (text.startsWith('/mis_actas')) await handleMisActas(chatId)
    else if (text.startsWith('/sistema')) await handleSistema(chatId)
    else if (text.startsWith('/mis_rondas')) await handleMisRondas(chatId)
    else if (text.startsWith('/mis_equipos')) await handleMisEquipos(chatId)
    else if (text.startsWith('/inventario')) await handleInventario(chatId)
    else if (text.startsWith('/mis_mantenimientos')) await handleMisMantenimientos(chatId)
    else if (text.startsWith('/mis_solicitudes')) await handleMisSolicitudes(chatId)
    else if (text.startsWith('/bajas')) await handleBajas(chatId)
    else if (text.startsWith('/noticias')) await handleNoticias(chatId)
    else if (text.startsWith('/catalogo')) await handleCatalogo(chatId)
    else if (text.startsWith('/mis_contratos')) await handleMisContratos(chatId)
    else if (text.startsWith('/como_funciona')) await handleComoFunciona(chatId)
    else if (text.startsWith('/centro_ayuda')) await handleCentroAyuda(chatId)
    else if (text.startsWith('/ayuda') || text.startsWith('/help')) await handleAyuda(chatId)
    else
      await sendTelegramMessage(
        chatId,
        `No reconozco ese comando\\. Escribe /ayuda para ver los comandos disponibles\\.`
      )
  } catch (err) {
    console.error(`[TELEGRAM] Error update ${update.update_id}:`, err)
  }
}

// ─── Helper getLinkedUser ─────────────────────────────────────────────────────

async function getLinkedUser(chatId: string) {
  return prisma.users.findFirst({
    where: { telegramChatId: chatId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isSuperAdmin: true,
      ticketsEnabled: true,
      inventoryEnabled: true,
      patrolsEnabled: true,
      newsEnabled: true,
      canRequestAssets: true,
      user_settings: { select: { telegramNotifications: true } },
    },
  })
}

// ─── Constantes de formato ────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
}

const STATUS_EMOJI: Record<string, string> = {
  OPEN: '🟡',
  IN_PROGRESS: '🔵',
  RESOLVED: '✅',
  CLOSED: '⚫',
}

const PRIO_EMOJI: Record<string, string> = {
  URGENT: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
}

const PATROL_STATUS: Record<string, string> = {
  PENDING: '⏳',
  IN_PROGRESS: '🔵',
  COMPLETED: '✅',
  MISSED: '❌',
  INCOMPLETE: '⚠️',
}

const CONTRACT_STATUS: Record<string, string> = {
  ACTIVE: '🟢',
  EXPIRING: '🟠',
  EXPIRED: '🔴',
  DRAFT: '⚪',
  TERMINATED: '⚫',
  RENEWED: '🔄',
}

const NEWS_TYPE: Record<string, string> = {
  NEWS: '📰',
  ANNOUNCEMENT: '📢',
  EVENT: '🗓️',
  BIRTHDAY: '🎂',
  HOLIDAY: '🏖️',
  ALERT: '🚨',
  INTERNAL_AD: '📋',
  RECOGNITION: '🏆',
}

// ─── Handlers: cuenta ─────────────────────────────────────────────────────────

async function handleStart(chatId: string, firstName: string) {
  const existing = await getLinkedUser(chatId)
  if (existing) {
    await sendTelegramMessage(
      chatId,
      `👋 Bienvenido de vuelta, *${escapeMdV2(existing.name)}*\\!\n\n` +
        `Tu cuenta ya está vinculada\\. Escribe /ayuda para ver los comandos\\.`
    )
    return
  }
  await sendTelegramMessage(
    chatId,
    `👋 Hola *${escapeMdV2(firstName)}*\\!\n\n` +
      `Soy el bot del sistema de gestión del centro comercial\\.\n\n` +
      `Para recibir alertas y usar comandos, vincula tu cuenta:\n` +
      `*/vincular \\<código\\>*\n\n` +
      `Obtén tu código en *Perfil* o *Configuración → Notificaciones → Telegram*\\.\n\n` +
      `Escribe /ayuda para ver todos los comandos\\.`
  )
}

async function handleVincular(chatId: string, _fromId: number, _firstName: string, code: string) {
  if (!code) {
    await sendTelegramMessage(
      chatId,
      `⚠️ Indica tu código:\n\n*/vincular \\<código\\>*\n\nObtén el código en *Perfil* o *Configuración → Notificaciones*\\.`
    )
    return
  }

  const rate = await checkTelegramVincularRateLimit(chatId)
  if (!rate.allowed) {
    await sendTelegramMessage(
      chatId,
      `⏳ Demasiados intentos de vinculación\\. Espera unos minutos e inténtalo de nuevo\\.`
    )
    return
  }

  const linkToken = await prisma.telegram_link_tokens.findFirst({
    where: { token: code.toUpperCase(), usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, name: true, phone: true } } },
  })
  if (!linkToken) {
    await sendTelegramMessage(
      chatId,
      `❌ Código inválido o expirado\\.\n\nGenera uno nuevo en *Perfil* o *Configuración → Notificaciones → Telegram*\\.`
    )
    return
  }

  const chatTaken = await prisma.users.findFirst({
    where: { telegramChatId: chatId, id: { not: linkToken.userId }, isActive: true },
    select: { id: true, name: true },
  })
  if (chatTaken) {
    await sendTelegramMessage(
      chatId,
      `⚠️ Este chat ya está vinculado a *${escapeMdV2(chatTaken.name)}*\\.\n\n` +
        `Desvincula con /desvincular desde esa cuenta o usa otro chat de Telegram\\.`
    )
    return
  }

  await prisma.$transaction([
    prisma.users.updateMany({
      where: { telegramChatId: chatId, id: { not: linkToken.userId } },
      data: { telegramChatId: null },
    }),
    prisma.telegram_link_tokens.update({
      where: { id: linkToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.users.update({ where: { id: linkToken.userId }, data: { telegramChatId: chatId } }),
  ])
  await resetTelegramVincularRateLimit(chatId)
  const phoneHint = linkToken.user.phone
    ? `\n📱 *Teléfono:* ${escapeMdV2(linkToken.user.phone)}`
    : ''
  await sendTelegramMessage(
    chatId,
    `✅ *¡Cuenta vinculada\\!*\n\nRecibirás alertas como *${escapeMdV2(linkToken.user.name)}*\\.` +
      phoneHint +
      `\n\nEscribe /ayuda para ver los comandos\\.`
  )
}

async function handleDesvincular(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `ℹ️ Este chat no está vinculado a ninguna cuenta\\.`)
    return
  }
  await prisma.users.update({ where: { id: user.id }, data: { telegramChatId: null } })
  await sendTelegramMessage(
    chatId,
    `🔓 Cuenta de *${escapeMdV2(user.name)}* desvinculada\\.\n\nUsa /vincular para reconectar cuando quieras\\.`
  )
}

async function handleEstado(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(
      chatId,
      `❌ Chat no vinculado\\. Usa /vincular \\<código\\> para conectar tu cuenta\\.`
    )
    return
  }
  const tgEnabled = user.user_settings?.telegramNotifications ?? true
  const phoneLine = user.phone ? `\n📱 *Teléfono:* ${escapeMdV2(user.phone)}` : ''
  await sendTelegramMessage(
    chatId,
    `✅ *Cuenta vinculada*\n\n` +
      `👤 *Nombre:* ${escapeMdV2(user.name)}\n` +
      `📧 *Email:* ${escapeMdV2(user.email)}` +
      phoneLine +
      `\n` +
      `🏷️ *Rol:* ${escapeMdV2(ROLE_LABEL[user.role] ?? user.role)}\n` +
      `${tgEnabled ? '🟢' : '🔴'} *Alertas:* ${escapeMdV2(tgEnabled ? 'Activadas' : 'Desactivadas')}\n\n` +
      `Escribe /ayuda para ver los comandos\\.`
  )
}

// ─── Handlers: tickets ────────────────────────────────────────────────────────

async function handleMisTickets(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (!user.ticketsEnabled && user.role === 'CLIENT') {
    await sendTelegramMessage(chatId, `⚠️ No tienes el módulo de Tickets activado\\.`)
    return
  }
  const isAdmin = user.role === 'ADMIN',
    isTech = user.role === 'TECHNICIAN'
  const activeStatuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS']
  const where = isAdmin
    ? { status: { in: activeStatuses } }
    : isTech
      ? { assigneeId: user.id, status: { in: activeStatuses } }
      : { clientId: user.id, status: { in: activeStatuses } }

  const tickets = await prisma.tickets.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 8,
    select: { ticketCode: true, title: true, status: true, priority: true },
  })
  if (!tickets.length) {
    await sendTelegramMessage(chatId, `✅ No tienes tickets activos en este momento\\.`)
    return
  }

  const lines = tickets.map(t => {
    const code = t.ticketCode ? `\\[${escapeMdV2(t.ticketCode)}\\] ` : ''
    return `${STATUS_EMOJI[t.status] ?? '❓'} ${code}${escapeMdV2(t.title.substring(0, 45) + (t.title.length > 45 ? '…' : ''))}`
  })
  const header = isAdmin
    ? `📋 *Tickets activos \\(${tickets.length}\\)*`
    : isTech
      ? `📋 *Mis asignados \\(${tickets.length}\\)*`
      : `📋 *Mis tickets \\(${tickets.length}\\)*`
  await sendTelegramMessage(
    chatId,
    `${header}\n\n${lines.join('\n')}\n\n_Detalle completo en el sistema_\\.`
  )
}

async function handleMiTecnico(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (user.role !== 'CLIENT') {
    await sendTelegramMessage(
      chatId,
      `ℹ️ Este comando es para clientes\\. Tú ves tus asignaciones con /mis\\_tickets\\.`
    )
    return
  }
  const ticket = await prisma.tickets.findFirst({
    where: {
      clientId: user.id,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      assigneeId: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      ticketCode: true,
      title: true,
      status: true,
      users_tickets_assigneeIdTousers: { select: { name: true, email: true, phone: true } },
    },
  })
  if (!ticket || !ticket.users_tickets_assigneeIdTousers) {
    await sendTelegramMessage(
      chatId,
      `ℹ️ No tienes tickets activos con técnico asignado en este momento\\.`
    )
    return
  }
  const tech = ticket.users_tickets_assigneeIdTousers
  const code = ticket.ticketCode ? ` \\[${escapeMdV2(ticket.ticketCode)}\\]` : ''
  const phoneLine = tech.phone ? `\n📱 *Teléfono:* ${escapeMdV2(tech.phone)}` : ''
  await sendTelegramMessage(
    chatId,
    `🔧 *Tu técnico asignado*\n\n` +
      `🎫 *Ticket:*${code} ${escapeMdV2(ticket.title.substring(0, 50))}\n` +
      `${STATUS_EMOJI[ticket.status] ?? '❓'} *Estado:* ${escapeMdV2(ticket.status.replace('_', ' '))}\n\n` +
      `👤 *Técnico:* ${escapeMdV2(tech.name)}\n` +
      `📧 *Email:* ${escapeMdV2(tech.email)}` +
      phoneLine +
      `\n\n` +
      `_Puedes contactarlo directamente o añadir un comentario en el ticket_\\.`
  )
}

async function handlePendientes(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (user.role !== 'ADMIN' && user.role !== 'TECHNICIAN') {
    await sendTelegramMessage(chatId, `⚠️ Solo disponible para técnicos y administradores\\.`)
    return
  }

  let where: { status: 'OPEN'; assigneeId?: string; familyId?: { in: string[] } } = {
    status: 'OPEN',
  }
  if (user.role === 'TECHNICIAN') {
    where = { assigneeId: user.id, status: 'OPEN' }
  } else {
    const scope = await getUserFamilyScope(user.id, user.role, user.isSuperAdmin)
    if (scope.familyIds !== undefined) {
      if (scope.familyIds.length === 0) {
        await sendTelegramMessage(
          chatId,
          `ℹ️ No tienes familias asignadas para consultar tickets\\.`
        )
        return
      }
      where = { status: 'OPEN', familyId: { in: scope.familyIds } }
    }
  }

  const [tickets, count] = await Promise.all([
    prisma.tickets.findMany({
      where,
      take: 10,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      select: { ticketCode: true, title: true, priority: true },
    }),
    prisma.tickets.count({ where }),
  ])
  if (!tickets.length) {
    await sendTelegramMessage(chatId, `✅ No hay tickets pendientes\\.`)
    return
  }
  const lines = tickets.map(t => {
    const code = t.ticketCode ? `\\[${escapeMdV2(t.ticketCode)}\\] ` : ''
    return `${PRIO_EMOJI[t.priority] ?? '⚪'} ${code}${escapeMdV2(t.title.substring(0, 40) + (t.title.length > 40 ? '…' : ''))}`
  })
  const extra = count > 10 ? `\n_\\.\\.\\. y ${count - 10} más_` : ''
  await sendTelegramMessage(
    chatId,
    `🎫 *Pendientes \\(${count}\\)*\n\n${lines.join('\n')}${extra}\n\n_Gestiona desde el sistema_\\.`
  )
}

// ─── Handlers: admin ─────────────────────────────────────────────────────────

async function handleActas(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (user.role !== 'ADMIN') {
    await sendTelegramMessage(chatId, `⚠️ Solo disponible para administradores\\.`)
    return
  }

  const scope = await getUserFamilyScope(user.id, user.role, user.isSuperAdmin)
  const familyFilter =
    scope.familyIds !== undefined
      ? scope.familyIds.length > 0
        ? {
            assignment: {
              equipment: { type: { familyId: { in: scope.familyIds } } },
            },
          }
        : null
      : {}

  if (familyFilter === null) {
    await sendTelegramMessage(chatId, `ℹ️ No tienes familias asignadas para consultar actas\\.`)
    return
  }

  const acts = await prisma.delivery_acts.findMany({
    where: {
      status: 'PENDING',
      expirationDate: { gt: new Date() },
      ...familyFilter,
    },
    orderBy: { expirationDate: 'asc' },
    take: 10,
    select: { folio: true, expirationDate: true, actType: true },
  })
  if (!acts.length) {
    await sendTelegramMessage(chatId, `✅ No hay actas pendientes de firma\\.`)
    return
  }

  const lines = acts.map(a => {
    const exp = new Date(a.expirationDate).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    })
    const tipo = escapeMdV2(a.actType.replace('_', ' ').toLowerCase())
    return `📄 ${escapeMdV2(a.folio)} \\(${tipo}\\) — vence ${escapeMdV2(exp)}`
  })
  await sendTelegramMessage(
    chatId,
    `📝 *Actas pendientes \\(${acts.length}\\)*\n\n${lines.join('\n')}\n\n_Inventario → Actas_\\.`
  )
}

async function handleSistema(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (user.role !== 'ADMIN') {
    await sendTelegramMessage(chatId, `⚠️ Solo disponible para administradores\\.`)
    return
  }

  const scope = await getUserFamilyScope(user.id, user.role, user.isSuperAdmin)
  const ticketFilter =
    scope.familyIds !== undefined
      ? scope.familyIds.length > 0
        ? { familyId: { in: scope.familyIds } }
        : null
      : {}
  const actFamilyFilter =
    scope.familyIds !== undefined
      ? scope.familyIds.length > 0
        ? {
            assignment: {
              equipment: { type: { familyId: { in: scope.familyIds } } },
            },
          }
        : null
      : {}
  const patrolFamilyFilter =
    scope.familyIds !== undefined
      ? scope.familyIds.length > 0
        ? { route: { familyId: { in: scope.familyIds } } }
        : null
      : {}

  if (ticketFilter === null || actFamilyFilter === null || patrolFamilyFilter === null) {
    await sendTelegramMessage(
      chatId,
      `ℹ️ No tienes familias asignadas para ver el resumen del sistema\\.`
    )
    return
  }

  const [open, inProgress, lastBackup, pendingActs, openPatrols] = await Promise.all([
    prisma.tickets.count({ where: { status: 'OPEN', ...ticketFilter } }),
    prisma.tickets.count({ where: { status: 'IN_PROGRESS', ...ticketFilter } }),
    prisma.backups.findFirst({
      where: { status: 'completed' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.delivery_acts.count({
      where: { status: 'PENDING', expirationDate: { gt: new Date() }, ...actFamilyFilter },
    }),
    prisma.patrols.count({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] }, ...patrolFamilyFilter },
    }),
  ])

  const scopeLabel =
    scope.familyIds === undefined
      ? 'Resumen del sistema'
      : `Resumen de tus áreas \\(${scope.familyIds.length}\\)`

  const bkLine = lastBackup
    ? `💾 *Último backup:* ${escapeMdV2(new Date(lastBackup.createdAt).toLocaleDateString('es-ES'))}`
    : `💾 *Último backup:* sin registros`

  await sendTelegramMessage(
    chatId,
    `⚙️ *${scopeLabel}*\n\n` +
      `🎫 Tickets abiertos: *${escapeMdV2(String(open))}*\n` +
      `🔵 En progreso: *${escapeMdV2(String(inProgress))}*\n` +
      `📝 Actas pendientes: *${escapeMdV2(String(pendingActs))}*\n` +
      `🔒 Rondas activas: *${escapeMdV2(String(openPatrols))}*\n` +
      bkLine +
      `\n\n_Panel completo en Admin → Dashboard_\\.`
  )
}

// ─── Handlers: rondas ────────────────────────────────────────────────────────

async function handleMisRondas(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (!user.patrolsEnabled) {
    await sendTelegramMessage(chatId, `⚠️ No tienes el módulo de Rondas activado\\.`)
    return
  }

  const patrols = await prisma.patrols.findMany({
    where: { agentId: user.id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    orderBy: { scheduledStart: 'asc' },
    take: 6,
    select: {
      status: true,
      scheduledStart: true,
      scheduledEnd: true,
      completionPercentage: true,
      route: { select: { name: true } },
    },
  })

  // Si no tiene propias, admin/tech puede ver las de su área
  if (!patrols.length && (user.role === 'ADMIN' || user.role === 'TECHNICIAN')) {
    const allPatrols = await prisma.patrols.findMany({
      where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: { scheduledStart: 'asc' },
      take: 6,
      select: {
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        completionPercentage: true,
        route: { select: { name: true } },
        agent: { select: { name: true } },
      },
    })
    if (!allPatrols.length) {
      await sendTelegramMessage(chatId, `✅ No hay rondas activas o programadas en este momento\\.`)
      return
    }
    const lines = allPatrols.map(p => {
      const hora = new Date(p.scheduledStart).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const ruta = p.route?.name ?? 'Sin ruta'
      const agente = (p as typeof p & { agent?: { name: string } }).agent?.name ?? '—'
      const pct = p.completionPercentage > 0 ? ` ${Math.round(p.completionPercentage)}%` : ''
      return `${PATROL_STATUS[p.status] ?? '❓'} ${escapeMdV2(ruta)} — ${escapeMdV2(hora)}${escapeMdV2(pct)} \\(${escapeMdV2(agente)}\\)`
    })
    await sendTelegramMessage(
      chatId,
      `🔒 *Rondas activas \\(${allPatrols.length}\\)*\n\n${lines.join('\n')}\n\n_Rondas → Dashboard_\\.`
    )
    return
  }

  if (!patrols.length) {
    await sendTelegramMessage(
      chatId,
      `✅ No tienes rondas activas o programadas en este momento\\.`
    )
    return
  }

  const lines = patrols.map(p => {
    const hora = new Date(p.scheduledStart).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const ruta = p.route?.name ?? 'Sin ruta'
    const pct = p.completionPercentage > 0 ? ` ${Math.round(p.completionPercentage)}%` : ''
    return `${PATROL_STATUS[p.status] ?? '❓'} *${escapeMdV2(ruta)}* — ${escapeMdV2(hora)}${escapeMdV2(pct)}`
  })
  await sendTelegramMessage(
    chatId,
    `🔒 *Mis rondas \\(${patrols.length}\\)*\n\n${lines.join('\n')}\n\n_Rondas → Mis Rondas_\\.`
  )
}

// ─── Handlers: inventario ─────────────────────────────────────────────────────

async function handleMisEquipos(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }

  const assignments = await prisma.equipment_assignments.findMany({
    where: { receiverId: user.id, isActive: true },
    orderBy: { startDate: 'desc' },
    take: 8,
    select: {
      assignmentType: true,
      startDate: true,
      equipment: {
        select: {
          code: true,
          brand: true,
          modelDeprecated: true,
          status: true,
          model: { select: { model: true } },
        },
      },
    },
  })

  if (!assignments.length) {
    await sendTelegramMessage(chatId, `ℹ️ No tienes equipos asignados actualmente\\.`)
    return
  }

  const EQUIP_STATUS: Record<string, string> = {
    AVAILABLE: '🟢',
    ASSIGNED: '🔵',
    MAINTENANCE: '🔧',
    RETIRED: '⚫',
    FOR_SALE: '🏷️',
    SOLD: '✅',
  }
  const ASSIGN_TYPE: Record<string, string> = {
    PERMANENT: 'Permanente',
    TEMPORARY: 'Temporal',
    LOAN: 'Préstamo',
  }

  const lines = assignments.map(a => {
    const eq = a.equipment
    const name = eq.model?.model ?? eq.modelDeprecated ?? '—'
    const brand = eq.brand ? `${eq.brand} ` : ''
    const code = eq.code ? ` \\[${escapeMdV2(eq.code)}\\]` : ''
    const tipo = escapeMdV2(ASSIGN_TYPE[a.assignmentType] ?? a.assignmentType)
    const st = EQUIP_STATUS[eq.status] ?? '❓'
    return `${st} *${escapeMdV2(brand + name)}*${code} — ${tipo}`
  })

  await sendTelegramMessage(
    chatId,
    `📦 *Mis equipos asignados \\(${assignments.length}\\)*\n\n${lines.join('\n')}\n\n_Detalle en Inventario → Mis Equipos_\\.`
  )
}

// ─── Handlers: noticias, catálogo, contratos ─────────────────────────────────

async function handleNoticias(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (!user.newsEnabled && user.role === 'CLIENT') {
    await sendTelegramMessage(chatId, `⚠️ No tienes el módulo de Noticias activado\\.`)
    return
  }

  const now = new Date()
  const news = await prisma.news.findMany({
    where: {
      status: 'PUBLISHED',
      OR: [{ startDate: null }, { startDate: { lte: now } }],
      AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 5,
    select: { title: true, type: true, priority: true, summary: true, createdAt: true },
  })

  if (!news.length) {
    await sendTelegramMessage(chatId, `ℹ️ No hay noticias publicadas en este momento\\.`)
    return
  }

  const lines = news.map(n => {
    const typeEmoji = NEWS_TYPE[n.type] ?? '📄'
    const fecha = new Date(n.createdAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
    })
    const summary = n.summary
      ? `\n   _${escapeMdV2(n.summary.substring(0, 80) + (n.summary.length > 80 ? '…' : ''))}_`
      : ''
    return `${typeEmoji} *${escapeMdV2(n.title)}* \\(${escapeMdV2(fecha)}\\)${summary}`
  })

  await sendTelegramMessage(
    chatId,
    `📰 *Últimas noticias \\(${news.length}\\)*\n\n${lines.join('\n\n')}\n\n_Ver todas en Noticias_\\.`
  )
}

async function handleCatalogo(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }

  const sales = await prisma.equipment_sales.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      salePrice: true,
      equipment: {
        select: {
          code: true,
          brand: true,
          modelDeprecated: true,
          saleListingPrice: true,
          model: { select: { model: true } },
        },
      },
    },
  })

  if (!sales.length) {
    await sendTelegramMessage(
      chatId,
      `ℹ️ No hay equipos disponibles para la venta en este momento\\.\n\n_Consulta con administración para más información_\\.`
    )
    return
  }

  const lines = sales.map(s => {
    const eq = s.equipment
    const name = eq.model?.model ?? eq.modelDeprecated ?? 'Equipo'
    const brand = eq.brand ? `${eq.brand} ` : ''
    const code = eq.code ? ` \\[${escapeMdV2(eq.code)}\\]` : ''
    // Mostrar precio de venta aprobado; si no, el precio de catálogo del equipo
    const displayPrice = s.salePrice ?? eq.saleListingPrice
    const price = displayPrice ? `$${escapeMdV2(displayPrice.toFixed(2))}` : 'Consultar'
    return `🏷️ *${escapeMdV2(brand + name)}*${code} — ${price}`
  })

  await sendTelegramMessage(
    chatId,
    `🛒 *Equipos en venta \\(${sales.length}\\)*\n\n${lines.join('\n')}\n\n` +
      `_Para adquirir un equipo contacta a administración\\._`
  )
}

async function handleMisContratos(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }

  const contracts = await prisma.contracts.findMany({
    where: {
      status: { in: ['ACTIVE', 'EXPIRING'] },
      OR: [{ custodianUserId: user.id }, { backupCustodianUserId: user.id }],
    },
    orderBy: { endDate: 'asc' },
    take: 8,
    select: {
      contractNumber: true,
      name: true,
      status: true,
      endDate: true,
      monthlyCost: true,
      currency: true,
    },
  })

  if (!contracts.length) {
    await sendTelegramMessage(
      chatId,
      `ℹ️ No tienes contratos activos asignados como custodio comercial\\.`
    )
    return
  }

  const lines = contracts.map(c => {
    const num = c.contractNumber ? ` \\[${escapeMdV2(c.contractNumber)}\\]` : ''
    const st = CONTRACT_STATUS[c.status] ?? '❓'
    const end = c.endDate
      ? ` — vence ${escapeMdV2(new Date(c.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }))}`
      : ''
    const cost = c.monthlyCost
      ? `\n   💰 ${escapeMdV2(c.currency)} ${escapeMdV2(c.monthlyCost.toFixed(2))}/mes`
      : ''
    return `${st} *${escapeMdV2(c.name.substring(0, 45))}*${num}${escapeMdV2(end)}${cost}`
  })

  await sendTelegramMessage(
    chatId,
    `📑 *Mis contratos \\(${contracts.length}\\)*\n\n${lines.join('\n\n')}\n\n_Detalle completo en Contratos_\\.`
  )
}

// ─── Handler: ayuda dinámica por módulos y rol ────────────────────────────────

async function handleAyuda(chatId: string) {
  const user = await getLinkedUser(chatId)
  const isAdmin = user?.role === 'ADMIN'
  const isTech = user?.role === 'TECHNICIAN'
  const isClient = user?.role === 'CLIENT'

  // ── Sección cuenta (siempre visible) ────────────────────────────────────────
  const cuentaCmds =
    `*/start* — Bienvenido\n` +
    `*/vincular \\<código\\>* — Vincular cuenta\n` +
    `*/estado* — Ver tu cuenta y alertas\n` +
    `*/desvincular* — Desconectar\n` +
    `*/como\\_funciona* — Cómo usar el sistema según tu rol\n` +
    `*/centro\\_ayuda* — Enlace al Centro de Ayuda\n` +
    `*/ayuda* — Esta ayuda`

  if (!user) {
    await sendTelegramMessage(
      chatId,
      `📖 *Comandos disponibles*\n\n🔗 *Cuenta:*\n${cuentaCmds}\n\n` +
        `_Vincula tu cuenta para ver los comandos operativos\\._ `
    )
    return
  }

  // ── Sección tickets ──────────────────────────────────────────────────────────
  let ticketsCmds = ''
  if (user.ticketsEnabled || isAdmin || isTech) {
    ticketsCmds += `\n\n🎫 *Tickets:*\n`
    ticketsCmds += `*/mis\\_tickets* — Tus tickets activos\n`
    if (isTech || isAdmin) ticketsCmds += `*/pendientes* — Tickets abiertos por prioridad\n`
    if (isClient) ticketsCmds += `*/mi\\_tecnico* — Ver técnico asignado a tu ticket\n`
  }

  // ── Sección inventario ───────────────────────────────────────────────────────
  let inventarioCmds = ''
  inventarioCmds += `\n\n📦 *Inventario:*\n`
  inventarioCmds += `*/mis\\_equipos* — Equipos asignados a ti\n`
  inventarioCmds += `*/mis\\_actas* — Tus actas de entrega y devolución\n`
  inventarioCmds += `*/catalogo* — Equipos disponibles para la venta\n`
  if (user.canRequestAssets || isAdmin)
    inventarioCmds += `*/mis\\_solicitudes* — Tus solicitudes de activos\n`
  if (user.inventoryEnabled || isAdmin) {
    inventarioCmds += `*/mis\\_mantenimientos* — Equipos tuyos en mantenimiento\n`
    inventarioCmds += `*/inventario* — Resumen de equipos por estado\n`
  }
  if (isAdmin) inventarioCmds += `*/actas* — Actas pendientes de firma \\(todas\\)\n`
  if (isAdmin || isTech) inventarioCmds += `*/bajas* — Solicitudes de baja en revisión\n`

  // ── Sección contratos ────────────────────────────────────────────────────────
  const contratosCmds = `\n\n📑 *Contratos:*\n*/mis\\_contratos* — Tus contratos activos como custodio comercial\n`

  // ── Sección rondas ───────────────────────────────────────────────────────────
  let rondasCmds = ''
  if (user.patrolsEnabled || isAdmin) {
    rondasCmds = `\n\n🔒 *Rondas:*\n*/mis\\_rondas* — Rondas activas y programadas\n`
  }

  // ── Sección noticias ─────────────────────────────────────────────────────────
  let noticiasCmds = ''
  if (user.newsEnabled || isAdmin) {
    noticiasCmds = `\n\n📰 *Noticias:*\n*/noticias* — Últimas noticias publicadas\n`
  }

  // ── Sección admin ────────────────────────────────────────────────────────────
  const adminCmds = isAdmin
    ? `\n\n⚙️ *Administración:*\n*/sistema* — Resumen del estado del sistema\n`
    : ''

  const footer = `\n\n💡 _Las alertas llegan automáticamente para tickets, inventario y backups\\._ `

  await sendTelegramMessage(
    chatId,
    `📖 *Comandos disponibles*\n\n🔗 *Cuenta:*\n${cuentaCmds}` +
      ticketsCmds +
      inventarioCmds +
      contratosCmds +
      rondasCmds +
      noticiasCmds +
      adminCmds +
      footer
  )
}

// ─── Handlers: inventario extendido (todos los roles) ────────────────────────

/**
 * /mis_actas — actas de entrega Y devolución donde el usuario es receptor o entregador.
 * Acceso: TODOS (cualquier rol con asignaciones).
 * Muestra estado, folio, fecha y si está pendiente de firma.
 */
async function handleMisActas(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }

  // Las actas se vinculan al usuario a través de equipment_assignments
  // Buscar asignaciones activas O inactivas recientes (últimos 90 días) del usuario
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const [deliveryActs, returnActs] = await Promise.all([
    // Actas de entrega: el usuario es receptor (receiverId) o entregador (delivererId)
    prisma.delivery_acts.findMany({
      where: {
        assignment: {
          OR: [{ receiverId: user.id }, { delivererId: user.id }],
          createdAt: { gte: cutoff },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        folio: true,
        status: true,
        actType: true,
        expirationDate: true,
        acceptedAt: true,
        assignment: {
          select: {
            equipment: { select: { code: true, brand: true, modelDeprecated: true } },
          },
        },
      },
    }),
    // Actas de devolución: mismo criterio
    prisma.return_acts.findMany({
      where: {
        assignment: {
          OR: [{ receiverId: user.id }, { delivererId: user.id }],
          createdAt: { gte: cutoff },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        folio: true,
        status: true,
        returnDate: true,
        acceptedAt: true,
        assignment: {
          select: {
            equipment: { select: { code: true, brand: true, modelDeprecated: true } },
          },
        },
      },
    }),
  ])

  if (!deliveryActs.length && !returnActs.length) {
    await sendTelegramMessage(
      chatId,
      `ℹ️ No tienes actas de entrega o devolución en los últimos 90 días\\.`
    )
    return
  }

  const ACT_STATUS: Record<string, string> = {
    PENDING: '⏳ Pendiente',
    ACCEPTED: '✅ Firmada',
    REJECTED: '❌ Rechazada',
    EXPIRED: '🔴 Expirada',
  }
  const ACT_TYPE_SHORT: Record<string, string> = {
    EQUIPMENT_ASSIGNMENT: 'Entrega',
    MRO_DELIVERY: 'Entrega MRO',
    SERVICE_COMPLETION: 'Servicio',
    ASSET_TRANSFER: 'Transferencia',
    CONTRACT_RENEWAL: 'Renovación',
    SUBSCRIPTION_ASSIGNMENT: 'Suscripción',
  }

  const lines: string[] = []

  for (const a of deliveryActs) {
    const eq = a.assignment?.equipment
    const nombre = eq ? `${eq.brand ?? ''} ${eq.modelDeprecated ?? eq.code ?? ''}`.trim() : '—'
    const tipo = ACT_TYPE_SHORT[a.actType] ?? a.actType
    const st = ACT_STATUS[a.status] ?? a.status
    const pending =
      a.status === 'PENDING'
        ? ` \\(vence ${escapeMdV2(new Date(a.expirationDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }))}\\)`
        : ''
    lines.push(
      `📋 *${escapeMdV2(a.folio)}* — ${escapeMdV2(tipo)}\n   ${escapeMdV2(nombre)} — ${escapeMdV2(st)}${pending}`
    )
  }

  for (const r of returnActs) {
    const eq = r.assignment?.equipment
    const nombre = eq ? `${eq.brand ?? ''} ${eq.modelDeprecated ?? eq.code ?? ''}`.trim() : '—'
    const st = ACT_STATUS[r.status] ?? r.status
    lines.push(
      `🔄 *${escapeMdV2(r.folio)}* — Devolución\n   ${escapeMdV2(nombre)} — ${escapeMdV2(st)}`
    )
  }

  const total = deliveryActs.length + returnActs.length
  await sendTelegramMessage(
    chatId,
    `📋 *Mis actas \\(${total}\\)*\n\n${lines.join('\n\n')}\n\n_Detalle completo en Inventario → Actas_\\.`
  )
}

/**
 * /mis_mantenimientos — equipos asignados al usuario que están en mantenimiento,
 * O registros de mantenimiento donde el usuario es técnico o solicitante.
 * Acceso: TODOS con equipos asignados o inventoryEnabled.
 */
async function handleMisMantenimientos(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }

  const isTechOrAdmin = user.role === 'ADMIN' || user.role === 'TECHNICIAN'
  const activeMaintenanceStatuses: MaintenanceStatus[] = ['REQUESTED', 'SCHEDULED', 'ACCEPTED']

  // Para técnicos/admins: mantenimientos asignados a ellos
  // Para clientes: equipos que les asignaron y están en mantenimiento
  const where = isTechOrAdmin
    ? {
        OR: [{ technicianId: user.id }, { requestedById: user.id }],
        status: { in: activeMaintenanceStatuses },
      }
    : {
        status: { in: activeMaintenanceStatuses },
        equipment: {
          is: {
            assignments: {
              some: { receiverId: user.id, isActive: true },
            },
          },
        },
      }

  const records = await prisma.maintenance_records.findMany({
    where,
    orderBy: { date: 'asc' },
    take: 8,
    select: {
      type: true,
      status: true,
      date: true,
      description: true,
      equipment: { select: { code: true, brand: true, modelDeprecated: true } },
    },
  })

  if (!records.length) {
    await sendTelegramMessage(
      chatId,
      `✅ No tienes equipos en mantenimiento activo en este momento\\.`
    )
    return
  }

  const MAINT_STATUS: Record<string, string> = {
    REQUESTED: '📥 Solicitado',
    SCHEDULED: '📅 Programado',
    ACCEPTED: '🔧 En proceso',
    COMPLETED: '✅ Completado',
    CANCELLED: '⚫ Cancelado',
  }
  const MAINT_TYPE: Record<string, string> = { PREVENTIVE: 'Preventivo', CORRECTIVE: 'Correctivo' }

  const lines = records.map(r => {
    const eq = r.equipment
    const nombre = `${eq.brand ?? ''} ${eq.modelDeprecated ?? eq.code ?? ''}`.trim()
    const fecha = new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
    const tipo = MAINT_TYPE[r.type] ?? r.type
    const st = MAINT_STATUS[r.status] ?? r.status
    const desc = r.description.substring(0, 50) + (r.description.length > 50 ? '…' : '')
    return `🔧 *${escapeMdV2(nombre)}* \\[${escapeMdV2(eq.code)}\\]\n   ${escapeMdV2(tipo)} — ${escapeMdV2(st)} — ${escapeMdV2(fecha)}\n   _${escapeMdV2(desc)}_`
  })

  await sendTelegramMessage(
    chatId,
    `🔧 *Mantenimientos activos \\(${records.length}\\)*\n\n${lines.join('\n\n')}\n\n_Detalle en Inventario → Mantenimiento_\\.`
  )
}

/**
 * /mis_solicitudes — solicitudes de activos (asset_requests) creadas por el usuario.
 * Acceso: canRequestAssets=true o Admin.
 */
async function handleMisSolicitudes(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (!user.canRequestAssets && user.role !== 'ADMIN') {
    await sendTelegramMessage(chatId, `⚠️ No tienes permiso para solicitar activos\\.`)
    return
  }

  const requests = await prisma.asset_requests.findMany({
    where: {
      requesterId: user.id,
      status: { in: ['PENDING', 'UNDER_REVIEW', 'APPROVED'] as const },
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: {
      code: true,
      assetType: true,
      status: true,
      description: true,
      createdAt: true,
      slaDeadline: true,
    },
  })

  if (!requests.length) {
    await sendTelegramMessage(
      chatId,
      `ℹ️ No tienes solicitudes de activos activas\\.\n\nPuedes crear una desde el sistema: Inventario → Solicitudes\\.`
    )
    return
  }

  const REQ_STATUS: Record<string, string> = {
    PENDING: '⏳ Pendiente',
    UNDER_REVIEW: '🔍 En revisión',
    APPROVED: '✅ Aprobada',
    REJECTED: '❌ Rechazada',
    FULFILLED: '📦 Entregada',
  }
  const ASSET_TYPE: Record<string, string> = {
    EQUIPMENT: 'Equipo',
    LICENSE: 'Licencia',
    OTHER: 'Otro',
  }

  const lines = requests.map(r => {
    const st = REQ_STATUS[r.status] ?? r.status
    const tipo = ASSET_TYPE[r.assetType] ?? r.assetType
    const desc = r.description.substring(0, 55) + (r.description.length > 55 ? '…' : '')
    const sla = r.slaDeadline
      ? `\n   ⏰ SLA: ${escapeMdV2(new Date(r.slaDeadline).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }))}`
      : ''
    return `📦 *\\[${escapeMdV2(r.code)}\\]* ${escapeMdV2(tipo)} — ${escapeMdV2(st)}\n   _${escapeMdV2(desc)}_${sla}`
  })

  await sendTelegramMessage(
    chatId,
    `📦 *Mis solicitudes \\(${requests.length}\\)*\n\n${lines.join('\n\n')}\n\n_Gestiona desde Inventario → Solicitudes_\\.`
  )
}

/**
 * /inventario — resumen de equipos por estado para el área del usuario.
 * Acceso: Admin + Técnico con inventoryEnabled.
 * Si es SuperAdmin, muestra totales globales.
 */
async function handleInventario(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (!user.inventoryEnabled && user.role !== 'ADMIN') {
    await sendTelegramMessage(chatId, `⚠️ No tienes el módulo de Inventario activado\\.`)
    return
  }

  // Contar equipos por estado (global para admin, del área para técnico)
  const [available, assigned, maintenance, forSale, damaged, retired] = await Promise.all([
    prisma.equipment.count({ where: { status: 'AVAILABLE' } }),
    prisma.equipment.count({ where: { status: 'ASSIGNED' } }),
    prisma.equipment.count({ where: { status: 'MAINTENANCE' } }),
    prisma.equipment.count({ where: { status: 'FOR_SALE' } }),
    prisma.equipment.count({ where: { status: 'DAMAGED' } }),
    prisma.equipment.count({ where: { status: 'RETIRED' } }),
  ])

  const total = available + assigned + maintenance + forSale + damaged + retired

  // Mantenimientos activos y solicitudes pendientes de activos
  const [pendingMaint, pendingRequests, pendingDecomm] = await Promise.all([
    prisma.maintenance_records.count({
      where: { status: { in: ['REQUESTED', 'SCHEDULED', 'ACCEPTED'] } },
    }),
    prisma.asset_requests.count({ where: { status: { in: ['PENDING', 'UNDER_REVIEW'] } } }),
    user.role === 'ADMIN'
      ? prisma.decommission_requests.count({
          where: { status: { in: ['PENDING', 'TECHNICAL_REVIEW', 'MANAGER_REVIEW'] } },
        })
      : Promise.resolve(0),
  ])

  const adminLines =
    user.role === 'ADMIN'
      ? `\n📥 *Solicitudes activos pendientes:* ${escapeMdV2(String(pendingRequests))}\n` +
        `⚠️ *Bajas en revisión:* ${escapeMdV2(String(pendingDecomm))}`
      : ''

  await sendTelegramMessage(
    chatId,
    `📦 *Resumen de inventario*\n\n` +
      `📊 *Total equipos:* ${escapeMdV2(String(total))}\n\n` +
      `🟢 Disponibles: *${escapeMdV2(String(available))}*\n` +
      `🔵 Asignados: *${escapeMdV2(String(assigned))}*\n` +
      `🔧 Mantenimiento: *${escapeMdV2(String(maintenance))}*\n` +
      `🏷️ En venta: *${escapeMdV2(String(forSale))}*\n` +
      `🟠 Dañados: *${escapeMdV2(String(damaged))}*\n` +
      `⚫ Retirados: *${escapeMdV2(String(retired))}*\n\n` +
      `🔧 *Mant\\. activos:* ${escapeMdV2(String(pendingMaint))}` +
      adminLines +
      `\n\n_Detalle completo en Inventario_\\.`
  )
}

/**
 * /bajas — solicitudes de baja pendientes de revisión.
 * Acceso: Admin (ver todas) y Técnico (solo las asignadas a él).
 */
async function handleBajas(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta con /vincular \\<código\\>\\.`)
    return
  }
  if (user.role !== 'ADMIN' && user.role !== 'TECHNICIAN') {
    await sendTelegramMessage(chatId, `⚠️ Solo disponible para técnicos y administradores\\.`)
    return
  }

  const where =
    user.role === 'TECHNICIAN'
      ? { technicianId: user.id, status: { in: ['TECHNICAL_REVIEW'] as DecommissionStatus[] } }
      : {
          status: { in: ['PENDING', 'TECHNICAL_REVIEW', 'MANAGER_REVIEW'] as DecommissionStatus[] },
        }

  const requests = await prisma.decommission_requests.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    take: 8,
    select: {
      id: true,
      status: true,
      reason: true,
      assetType: true,
      createdAt: true,
      equipment: { select: { code: true, brand: true, modelDeprecated: true } },
    },
  })

  if (!requests.length) {
    await sendTelegramMessage(chatId, `✅ No hay solicitudes de baja pendientes de revisión\\.`)
    return
  }

  const DECOMM_STATUS: Record<string, string> = {
    PENDING: '⏳ Pendiente',
    TECHNICAL_REVIEW: '🔍 Dictamen técnico',
    MANAGER_REVIEW: '👤 Revisión gestor',
    APPROVED: '✅ Aprobada',
    REJECTED: '❌ Rechazada',
  }
  const ASSET_TYPE: Record<string, string> = { EQUIPMENT: 'Equipo', LICENSE: 'Licencia' }

  const lines = requests.map(r => {
    const st = DECOMM_STATUS[r.status] ?? r.status
    const tipo = ASSET_TYPE[r.assetType] ?? r.assetType
    const eq = r.equipment
    const nombre = eq
      ? `${eq.brand ?? ''} ${eq.modelDeprecated ?? eq.code ?? ''}`.trim()
      : 'Sin equipo'
    const code = eq?.code ? ` \\[${escapeMdV2(eq.code)}\\]` : ''
    const motivo = r.reason.substring(0, 50) + (r.reason.length > 50 ? '…' : '')
    return `⚠️ *${escapeMdV2(tipo)}:* ${escapeMdV2(nombre)}${code}\n   ${escapeMdV2(st)}\n   _${escapeMdV2(motivo)}_`
  })

  const header =
    user.role === 'TECHNICIAN'
      ? `⚠️ *Bajas pendientes de dictamen \\(${requests.length}\\)*`
      : `⚠️ *Solicitudes de baja en revisión \\(${requests.length}\\)*`

  await sendTelegramMessage(
    chatId,
    `${header}\n\n${lines.join('\n\n')}\n\n_Gestiona desde Inventario → Bajas_\\.`
  )
}

// ─── Handlers: ayuda y centro de ayuda ───────────────────────────────────────

/**
 * /centro_ayuda — enlace directo al Centro de Ayuda del sistema.
 * Disponible para todos los roles.
 */
async function handleCentroAyuda(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(
      chatId,
      `❌ Vincula tu cuenta primero con /vincular \\<código\\> para acceder al Centro de Ayuda\\.`
    )
    return
  }

  const appUrl = process.env.NEXTAUTH_URL ?? ''
  const helpUrl = appUrl ? `${appUrl}/help/center` : '/help/center'
  const urlEscaped = escapeMdV2(helpUrl)

  await sendTelegramMessage(
    chatId,
    `📚 *Centro de Ayuda*\n\n` +
      `Encuentra guías, tutoriales y respuestas a preguntas frecuentes del sistema\\.\n\n` +
      `[Abrir Centro de Ayuda](${urlEscaped})\n\n` +
      `También puedes escribir /como\\_funciona para ver un resumen de tu rol en el sistema\\.`
  )
}

/**
 * /como_funciona — explica el sistema según el rol del usuario.
 * Cada rol ve solo lo que le aplica y cómo usar el sistema eficientemente.
 */
async function handleComoFunciona(chatId: string) {
  const user = await getLinkedUser(chatId)
  if (!user) {
    await sendTelegramMessage(chatId, `❌ Vincula tu cuenta primero con /vincular \\<código\\>\\.`)
    return
  }

  const isAdmin = user.role === 'ADMIN'
  const isTech = user.role === 'TECHNICIAN'
  const isClient = user.role === 'CLIENT'

  let msg = `📖 *Cómo funciona el sistema — ${escapeMdV2(ROLE_LABEL[user.role] ?? user.role)}*\n\n`

  if (isAdmin) {
    msg +=
      `Eres *Administrador*\\. Tienes acceso completo a todos los módulos de tu área\\.\n\n` +
      `🎫 *Tickets*\n` +
      `Gestiona las solicitudes de soporte de tu área\\. Puedes asignar técnicos, cambiar prioridades, cerrar tickets y ver reportes\\. Los tickets urgentes llegan también por Telegram y correo\\.\n\n` +
      `📦 *Inventario*\n` +
      `Controla equipos, licencias, suministros y contratos de tu área\\. Las actas de entrega y devolución quedan registradas digitalmente con firma electrónica\\.\n\n` +
      `🔒 *Rondas*\n` +
      `Programa y supervisa las rondas de seguridad\\. Recibirás alertas si una ronda no se inicia o se cierra incompleta\\.\n\n` +
      `📰 *Noticias*\n` +
      `Publica comunicados, eventos y avisos para tu equipo\\.\n\n` +
      `📑 *Contratos y Proveedores*\n` +
      `Gestiona contratos de servicio, licencias y proveedores\\. Recibirás alertas de vencimiento próximo\\.\n\n` +
      `⚙️ *Configuración*\n` +
      `Configura categorías, SLA, usuarios, familias de área y módulos activos\\.\n\n` +
      `💡 _Tip: usa /sistema para ver el estado en tiempo real del centro comercial\\._`
  } else if (isTech) {
    msg +=
      `Eres *Técnico*\\. Atiendes tickets asignados y ejecutas rondas de seguridad\\.\n\n` +
      `🎫 *Tickets*\n` +
      `Recibirás tickets asignados por tu administrador\\. Cuando el cliente comenta, te llega alerta por Telegram\\. Al resolver un ticket, el cliente lo califica\\.\n\n` +
      `Flujo básico:\n` +
      `1\\. Te asignan el ticket → recibes Telegram\n` +
      `2\\. Atiendes y añades comentarios\n` +
      `3\\. Marcas como resuelto\n` +
      `4\\. El cliente califica\n\n` +
      `🔒 *Rondas*\n` +
      `Recibirás recordatorio antes de que inicie tu ronda\\. Ejecuta el recorrido desde la app escaneando los QR de cada checkpoint\\. Si no inicias a tiempo, tu supervisor es notificado\\.\n\n` +
      `📦 *Equipos*\n` +
      `Puedes ver los equipos asignados a ti y registrar mantenimientos\\.\n\n` +
      `💡 _Tip: usa /mis\\_tickets para ver tus asignaciones pendientes y /mis\\_rondas para tu agenda\\._ `
  } else if (isClient) {
    msg +=
      `Eres *Usuario/Cliente*\\. Puedes crear tickets de soporte y ver el estado de tus equipos\\.\n\n` +
      `🎫 *Tickets de soporte*\n` +
      `Crea un ticket cuando necesites ayuda técnica\\. Un técnico será asignado y recibirás notificación\\. Puedes comentar y seguir el estado desde el sistema o por Telegram\\.\n\n` +
      `Flujo:\n` +
      `1\\. Creas el ticket en el sistema\n` +
      `2\\. Se asigna un técnico → recibes aviso\n` +
      `3\\. El técnico responde → recibes Telegram\n` +
      `4\\. Cuando se resuelve → lo calificas\n\n` +
      `📦 *Mis equipos*\n` +
      `Ve los equipos asignados a ti, sus mantenimientos y las actas de entrega que debes firmar\\.\n\n` +
      `📑 *Mis suscripciones*\n` +
      `Consulta los contratos o suscripciones de servicio asociadas a tu cuenta\\.\n\n` +
      `💡 _Tip: usa /mi\\_tecnico para ver quién atiende tu ticket activo y cómo contactarlo\\._`
  }

  const appUrl = process.env.NEXTAUTH_URL ?? ''
  const helpUrl = appUrl ? `${appUrl}/help/center` : ''

  msg += `\n\n📚 Guías detalladas en el [Centro de Ayuda](${escapeMdV2(helpUrl || '/help/center')})\\.\n\nEscribe /ayuda para ver los comandos disponibles\\.`

  await sendTelegramMessage(chatId, msg)
}
