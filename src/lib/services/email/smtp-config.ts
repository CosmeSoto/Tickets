/**
 * Configuración SMTP unificada.
 * Admin UI guarda camelCase (smtpHost); la cola leía solo snake_case (smtp_host).
 * Aquí se aceptan ambos y se respeta emailEnabled.
 */

import prisma from '@/lib/prisma'
import { DEFAULT_SYSTEM_NAME } from '@/lib/branding'

export type UnifiedSmtpConfig = {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
}

function pick(
  map: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const k of keys) {
    const v = map[k]
    if (v != null && String(v).trim() !== '') return String(v)
  }
  return undefined
}

/**
 * Lee SMTP desde system_settings (camelCase o snake_case).
 * enabled=false si el super admin no activó el correo o falta host.
 */
export async function getUnifiedSmtpConfig(): Promise<UnifiedSmtpConfig | null> {
  try {
    const settings = await prisma.system_settings.findMany({
      where: {
        key: {
          in: [
            'emailEnabled',
            'email_enabled',
            'smtpHost',
            'smtp_host',
            'smtpPort',
            'smtp_port',
            'smtpUser',
            'smtp_user',
            'smtpPassword',
            'smtp_password',
            'smtpSecure',
            'smtp_secure',
            'emailFrom',
            'email_from',
            'systemName',
          ],
        },
      },
    })

    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value

    const enabledRaw = pick(map, 'emailEnabled', 'email_enabled')
    const enabled = enabledRaw === 'true'

    const host = pick(map, 'smtpHost', 'smtp_host')
    if (!enabled || !host) return null

    const user = pick(map, 'smtpUser', 'smtp_user') || ''
    const password = pick(map, 'smtpPassword', 'smtp_password') || ''
    const port = parseInt(pick(map, 'smtpPort', 'smtp_port') || '587', 10)
    const secure = pick(map, 'smtpSecure', 'smtp_secure') === 'true'
    const systemName = pick(map, 'systemName') || DEFAULT_SYSTEM_NAME
    let from = pick(map, 'emailFrom', 'email_from') || ''
    if (!from && user) from = `${systemName} <${user}>`

    return { enabled, host, port, secure, user, password, from }
  } catch (error) {
    console.error('[SMTP] Error leyendo configuración:', error)
    return null
  }
}

/** true si el super admin activó correo y hay host SMTP */
export async function isSystemEmailEnabled(): Promise<boolean> {
  const cfg = await getUnifiedSmtpConfig()
  return Boolean(cfg?.enabled && cfg.host)
}
