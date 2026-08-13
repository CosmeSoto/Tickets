import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { MaintenanceModeService } from '@/lib/services/maintenance-mode-service'

const MAINTENANCE_API_BYPASS = [
  '/api/auth/',
  '/api/config/maintenance',
  '/api/config/session-timeout',
  '/api/health',
  '/api/cron/',
  '/api/public/',
]

/**
 * Bloquea APIs operativas durante modo mantenimiento (excepto auth/config/cron).
 */
export async function checkMaintenanceForApi(
  request: NextRequest
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname
  if (!path.startsWith('/api/')) return null
  if (MAINTENANCE_API_BYPASS.some(p => path.startsWith(p))) return null

  const config = await MaintenanceModeService.getConfig()
  if (!config.enabled) return null

  let token: Awaited<ReturnType<typeof getToken>> = null
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  } catch {
    /* sin sesión */
  }

  const user = token
    ? {
        role: token.role as string | undefined,
        isSuperAdmin: token.isSuperAdmin === true,
      }
    : null

  if (user?.isSuperAdmin) return null
  if (config.allowAdmins && user?.role === 'ADMIN') return null

  return NextResponse.json(
    {
      success: false,
      error: 'Sistema en mantenimiento',
      code: 'MAINTENANCE_MODE',
      message: config.message,
    },
    { status: 503 }
  )
}
