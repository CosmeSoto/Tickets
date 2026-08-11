/**
 * Configuración del bot de Telegram unificada.
 *
 * Mismo patrón que smtp-config.ts:
 *   1. Lee de system_settings (guardado por el admin desde la UI)
 *   2. Cae back a variables de entorno (ENV) si no hay config en BD
 *   3. Expone getTelegramConfig() e isTelegramEnabled()
 *
 * Esto permite que el admin configure el bot desde Admin → Configuración → Telegram
 * sin necesidad de editar archivos de entorno ni reiniciar el servidor.
 */

import prisma from '@/lib/prisma'

export type TelegramBotConfig = {
  enabled: boolean
  botToken: string
  botUsername: string
  webhookSecret: string
}

/**
 * Lee la configuración del bot de Telegram.
 * Prioridad: system_settings (BD) → ENV vars → null
 *
 * El token es sensible y no se devuelve completo en la UI (solo el flag tokenConfigured).
 */
export async function getTelegramConfig(): Promise<TelegramBotConfig | null> {
  try {
    const rows = await prisma.system_settings.findMany({
      where: {
        key: {
          in: [
            'telegramEnabled',
            'telegramBotToken',
            'telegramBotUsername',
            'telegramWebhookSecret',
          ],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const r of rows) map[r.key] = r.value

    // Leer token: BD → ENV
    const tokenFromDb = map['telegramBotToken']?.trim()
    const botToken = tokenFromDb || process.env.TELEGRAM_BOT_TOKEN || ''

    if (!botToken) return null

    // enabled: BD → true si hay token en ENV y no hay override en BD
    const enabledRaw = map['telegramEnabled']
    const enabled =
      enabledRaw !== undefined
        ? enabledRaw === 'true'
        : !!process.env.TELEGRAM_BOT_TOKEN

    const botUsername =
      map['telegramBotUsername']?.trim() ||
      process.env.TELEGRAM_BOT_USERNAME ||
      ''

    const webhookSecret =
      map['telegramWebhookSecret']?.trim() ||
      process.env.TELEGRAM_WEBHOOK_SECRET ||
      ''

    return { enabled, botToken, botUsername, webhookSecret }
  } catch (err) {
    console.error('[TELEGRAM-CONFIG] Error leyendo configuración:', err)
    // Fallback a ENV puro si la BD no está disponible
    const botToken = process.env.TELEGRAM_BOT_TOKEN || ''
    if (!botToken) return null
    return {
      enabled: true,
      botToken,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
      webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    }
  }
}

/**
 * true si el bot está habilitado y el token está configurado.
 * Equivalente a isSystemEmailEnabled() de smtp-config.ts.
 */
export async function isTelegramEnabled(): Promise<boolean> {
  const cfg = await getTelegramConfig()
  return Boolean(cfg?.enabled && cfg.botToken)
}

/**
 * Construye la URL base de la Bot API para el token dado.
 * Usada internamente por telegram.service.ts en cada llamada.
 */
export function buildApiBase(botToken: string): string {
  return `https://api.telegram.org/bot${botToken}`
}
