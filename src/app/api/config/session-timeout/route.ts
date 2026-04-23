import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withCache } from '@/lib/api-cache'

export const dynamic = 'force-dynamic'

const DEFAULT_SESSION_TIMEOUT = 1440

export async function GET() {
  try {
    // Caché 10 minutos — la configuración de timeout cambia raramente
    const sessionTimeout = await withCache('config:session-timeout', 600, async () => {
      const setting = await prisma.system_settings.findUnique({
        where: { key: 'sessionTimeout' },
      })
      return setting ? parseInt(setting.value) : DEFAULT_SESSION_TIMEOUT
    })

    return NextResponse.json({ sessionTimeout, success: true })
  } catch (error) {
    console.error('[API] Error obteniendo session timeout:', error)
    return NextResponse.json({
      sessionTimeout: DEFAULT_SESSION_TIMEOUT,
      success: true,
      fallback: true,
    })
  }
}
