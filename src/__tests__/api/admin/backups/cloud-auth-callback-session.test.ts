/**
 * GET /api/admin/backups/cloud-auth/callback
 *
 * El callback OAuth de backups a la nube no llamaba a `getServerSession` en
 * ningún punto — el único control era mirar el `userId` embebido en el
 * query param `state` (`provider:userId`) y comprobar que ESE id fuera de un
 * Super Admin en BD, sin verificar que la petición actual viniera de la
 * sesión de ese usuario. Un atacante externo, SIN sesión alguna en la app,
 * podía iniciar su propio consentimiento OAuth contra Google/Microsoft
 * apuntando `redirect_uri` a este callback (con `state` vacío o con el ID
 * adivinado/conocido de cualquier Super Admin) y dejar su propio
 * `refresh_token` grabado como destino global de subida de backups.
 *
 * Fix: exigir sesión real (`requireSuperAdmin`, mismo criterio que el resto
 * de rutas de Backups) antes de procesar `code`/`state`, y además exigir que
 * el `userId` del `state` coincida con la sesión actual.
 */

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    users: { findUnique: jest.fn() },
    system_settings: { upsert: jest.fn() },
  },
}))

jest.mock('@/lib/oauth-config', () => ({
  getOAuthCredentials: jest.fn(),
}))

// fetch global usado por handleGoogleCallback/handleMicrosoftCallback — no debe
// llegar a invocarse si la sesión se rechaza antes.
const fetchMock = jest.fn()
;(global as any).fetch = fetchMock

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (url: string) => ({ status: 307, redirectUrl: url }),
  },
}))

import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { getOAuthCredentials } from '@/lib/oauth-config'
import { GET } from '@/app/api/admin/backups/cloud-auth/callback/route'

function req(query: string) {
  return {
    nextUrl: new URL(`https://app.test/api/admin/backups/cloud-auth/callback${query}`),
  } as any
}

describe('GET /api/admin/backups/cloud-auth/callback — exige sesión real', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('regresión: sin sesión, un atacante no puede completar el flujo aunque el state apunte a un Super Admin real', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true }) // el ID del state SÍ es super admin

    const res = await GET(req('?code=attacker-code&state=google-drive:real-super-admin-id'))

    expect(res.status).toBe(307) // redirect
    expect((res as any).redirectUrl).toContain('reason=not_super_admin')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(prisma.system_settings.upsert).not.toHaveBeenCalled()
  })

  it('regresión: con state vacío (sin userId), antes se colaba — ahora también se bloquea sin sesión', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const res = await GET(req('?code=attacker-code&state='))

    expect(res.status).toBe(307)
    expect((res as any).redirectUrl).toContain('reason=not_super_admin')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sesión de super admin válida pero state de OTRO usuario: rechazado por state_mismatch', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'me', role: 'ADMIN' },
    })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true })

    const res = await GET(req('?code=some-code&state=google-drive:someone-else'))

    expect(res.status).toBe(307)
    expect((res as any).redirectUrl).toContain('reason=state_mismatch')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sesión de super admin real y state propio: continúa el intercambio de token', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'me', role: 'ADMIN' },
    })
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({ isSuperAdmin: true })
    ;(getOAuthCredentials as jest.Mock).mockResolvedValue({
      clientId: 'id',
      clientSecret: 'secret',
    })
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ refresh_token: 'legit-token' }),
    })

    const res = await GET(req('?code=some-code&state=google-drive:me'))

    expect(res.status).toBe(307)
    expect((res as any).redirectUrl).toContain('cloud=authorized')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(prisma.system_settings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'backupGoogleRefreshToken' },
        update: expect.objectContaining({ value: 'legit-token' }),
      })
    )
  })
})
