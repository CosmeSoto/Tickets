/**
 * Configuración del bot de Telegram unificada.
 *
 * Mismo patrón que smtp-config.ts:
 *   1. Lee de system_settings (guardado por el admin desde la UI)
 *   2. Cae back a variables de entorno (ENV) si no hay config en BD
 *   3. Expone getTelegramConfig(), isTelegramEnabled() e isTelegramNotificationsEnabled()
 */

import prisma from '@/lib/prisma'

export type TelegramBotConfig = {
  enabled: boolean
  /** Switch global de alertas salientes (admins). El bot puede seguir activo para comandos. */
  notificationsEnabled: boolean
  botToken: string
  botUsername: string
  webhookSecret: string
}

/**
 * Lee la configuración del bot de Telegram.
 * Prioridad: system_settings (BD) → ENV vars → null
 */
export async function getTelegramConfig(): Promise<TelegramBotConfig | null> {
  try {
    const rows = await prisma.system_settings.findMany({
      where: {
        key: {
          in: [
            'telegramEnabled',
            'telegramNotificationsEnabled',
            'telegramBotToken',
            'telegramBotUsername',
            'telegramWebhookSecret',
          ],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value

    const tokenFromDb = map['telegramBotToken']?.trim()
    const botToken = tokenFromDb || process.env.TELEGRAM_BOT_TOKEN || ''

    if (!botToken) return null

    const enabledRaw = map['telegramEnabled']
    const enabled =
      enabledRaw !== undefined ? enabledRaw === 'true' : !!process.env.TELEGRAM_BOT_TOKEN

    const notificationsRaw = map['telegramNotificationsEnabled']
    const notificationsEnabled =
      notificationsRaw !== undefined ? notificationsRaw === 'true' : true

    const botUsername =
      map['telegramBotUsername']?.trim() || process.env.TELEGRAM_BOT_USERNAME || ''

    const webhookSecret =
      map['telegramWebhookSecret']?.trim() || process.env.TELEGRAM_WEBHOOK_SECRET || ''

    return { enabled, notificationsEnabled, botToken, botUsername, webhookSecret }
  } catch (err) {
    console.error('[TELEGRAM-CONFIG] Error leyendo configuración:', err)
    const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    if (!botToken) return null
    return {
      enabled: true,
      notificationsEnabled: true,
      botToken,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    }
  }
}

/** true si el bot está habilitado y el token está configurado. */
export async function isTelegramEnabled(): Promise<boolean> {
  const cfg = await getTelegramConfig()
  return Boolean(cfg?.enabled && cfg.botToken)
}

/** true si las alertas salientes por Telegram están permitidas a nivel sistema. */
export async function isTelegramNotificationsEnabled(): Promise<boolean> {
  const cfg = await getTelegramConfig()
  return Boolean(cfg?.enabled && cfg.botToken && cfg.notificationsEnabled)
}

export function buildApiBase(botToken: string): string {
  return `https://api.telegram.org/bot${botToken}`
}
