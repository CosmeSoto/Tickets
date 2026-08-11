/**
 * POST /api/admin/settings/test-telegram
 *
 * Verifica que el token del bot de Telegram es válido llamando getMe.
 * Solo Super Admin. Mismo patrón que test-email.
 *
 * Body: { botToken: string }  — puede ser el token recién escrito en el form
 *       (antes de guardarlo) igual que test-email recibe las credenciales SMTP.
 *
 * Respuesta exitosa:
 *   { success: true, bot: { id, username, firstName } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { getTelegramBotInfo, getTelegramWebhookInfo } from '@/lib/services/telegram.service'

const schema = z.object({
  botToken: z.string().min(10, 'El token del bot es requerido'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    const superCheck = await (
      await import('@/lib/auth/require-super-admin')
    ).requireSuperAdmin(session)
    if (!superCheck.ok) {
      return NextResponse.json({ error: superCheck.error }, { status: superCheck.status })
    }

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]
      return NextResponse.json(
        { error: `Datos incompletos: ${firstError.message}` },
        { status: 422 }
      )
    }

    const { botToken } = parsed.data

    // Verificar el token con getMe
    const botInfo = await getTelegramBotInfo(botToken)
    if (!botInfo) {
      return NextResponse.json(
        { error: 'Token inválido o no se pudo conectar con la Bot API de Telegram.' },
        { status: 400 }
      )
    }

    // Obtener info del webhook actual
    const webhookInfo = await getTelegramWebhookInfo(botToken)

    return NextResponse.json({
      success: true,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        firstName: botInfo.firstName,
      },
      webhookInfo: webhookInfo
        ? {
            url: webhookInfo.url,
            hasCustomCertificate: webhookInfo.has_custom_certificate,
            pendingUpdateCount: webhookInfo.pending_update_count,
            lastErrorMessage: webhookInfo.last_error_message ?? null,
            lastErrorDate: webhookInfo.last_error_date ?? null,
          }
        : null,
    })
  } catch (error) {
    console.error('[TEST-TELEGRAM] Error:', error)
    return NextResponse.json(
      { error: 'Error al verificar el bot de Telegram' },
      { status: 500 }
    )
  }
}
