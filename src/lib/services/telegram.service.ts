/**
 * TelegramService — cliente bot ligero para enviar alertas operativas al staff.
 *
 * Sin dependencias externas: llama directamente a la Bot API con fetch.
 * El token se resuelve en cada llamada desde system_settings (BD) con fallback a ENV.
 * Las credenciales solo se leen en servidor; este módulo nunca se importa en client bundles.
 */

import { getTelegramConfig, buildApiBase } from './telegram-config'

export type TelegramPriority = 'critical' | 'important' | 'optional'

export interface TelegramAlertInput {
  chatId: string
  title: string
  body: string
  priority: TelegramPriority
  /** URL absoluta o relativa al backoffice */
  link?: string
  /** Módulo de origen para el emoji */
  module?: 'tickets' | 'inventory' | 'backups' | 'patrols' | 'system'
}

const MODULE_EMOJI: Record<NonNullable<TelegramAlertInput['module']>, string> = {
  tickets: '🎫',
  inventory: '📦',
  backups: '💾',
  patrols: '🔒',
  system: '⚙️',
}

const PRIORITY_EMOJI: Record<TelegramPriority, string> = {
  critical: '🚨',
  important: '🔔',
  optional: '💬',
}

/**
 * Escapa caracteres especiales para MarkdownV2 de Telegram.
 * https://core.telegram.org/bots/api#markdownv2-style
 */
export function escapeMdV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, c => `\\${c}`)
}

/**
 * Envía un mensaje MarkdownV2 al chatId indicado.
 * Obtiene el token dinámicamente (BD → ENV).
 * Retorna true si tuvo éxito, false si falló — nunca lanza.
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const cfg = await getTelegramConfig()
  if (!cfg?.botToken) {
    console.log('[TELEGRAM] Bot no configurado — omitiendo mensaje')
    return false
  }

  const apiBase = buildApiBase(cfg.botToken)
  try {
    const res = await fetch(`${apiBase}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[TELEGRAM] Error sendMessage chatId=${chatId}: ${res.status} ${err}`)
      return false
    }

    return true
  } catch (err) {
    console.error('[TELEGRAM] Error de red sendMessage:', err)
    return false
  }
}

/**
 * Construye y envía una alerta formateada con emoji, módulo, título y link.
 * Método principal usado por queueTelegramNotification.
 */
export async function sendTelegramAlert(input: TelegramAlertInput): Promise<boolean> {
  const modEmoji = input.module ? MODULE_EMOJI[input.module] : '🔔'
  const priEmoji = PRIORITY_EMOJI[input.priority]

  const titleEscaped = escapeMdV2(input.title)
  const bodyEscaped = escapeMdV2(input.body)

  let text = `${priEmoji} ${modEmoji} *${titleEscaped}*\n\n${bodyEscaped}`

  if (input.link) {
    const appUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const fullUrl = input.link.startsWith('http') ? input.link : `${appUrl}${input.link}`
    const urlEscaped = escapeMdV2(fullUrl)
    text += `\n\n[Ver en el sistema](${urlEscaped})`
  }

  return sendTelegramMessage(input.chatId, text)
}

/**
 * Registra el webhook del bot en Telegram.
 * Llamar desde Admin → Configuración → Telegram tras guardar el token.
 */
export async function registerTelegramWebhook(
  webhookUrl: string,
  botToken?: string
): Promise<boolean> {
  // Aceptar token explícito (desde la UI antes de guardar) o leerlo de la config
  const token = botToken || (await getTelegramConfig())?.botToken
  if (!token) return false

  const apiBase = buildApiBase(token)
  const cfg = botToken ? null : await getTelegramConfig()
  const secret = cfg?.webhookSecret || process.env.TELEGRAM_WEBHOOK_SECRET || ''

  try {
    const body: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }
    if (secret) body.secret_token = secret

    const res = await fetch(`${apiBase}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    if (!data.ok) {
      console.error('[TELEGRAM] Error al registrar webhook:', data.description)
      return false
    }

    console.log('[TELEGRAM] Webhook registrado:', webhookUrl)
    return true
  } catch (err) {
    console.error('[TELEGRAM] Error de red al registrar webhook:', err)
    return false
  }
}

/**
 * Obtiene información del webhook actual (útil para diagnóstico en Admin UI).
 */
export async function getTelegramWebhookInfo(
  botToken?: string
): Promise<Record<string, unknown> | null> {
  const token = botToken || (await getTelegramConfig())?.botToken
  if (!token) return null

  try {
    const apiBase = buildApiBase(token)
    const res = await fetch(`${apiBase}/getWebhookInfo`)
    const data = await res.json()
    return data.ok ? data.result : null
  } catch {
    return null
  }
}

/**
 * Verifica que el token del bot es válido llamando getMe.
 * Retorna info del bot o null si falla.
 */
export async function getTelegramBotInfo(
  botToken?: string
): Promise<{ id: number; username: string; firstName: string } | null> {
  const token = botToken || (await getTelegramConfig())?.botToken
  if (!token) return null

  try {
    const apiBase = buildApiBase(token)
    const res = await fetch(`${apiBase}/getMe`)
    const data = await res.json()
    if (!data.ok) return null
    return {
      id: data.result.id,
      username: data.result.username ?? '',
      firstName: data.result.first_name ?? '',
    }
  } catch {
    return null
  }
}
