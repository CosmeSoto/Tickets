/**
 * PUT /api/families/[id]/ticket-config
 *
 * Techo de prioridad a nivel de familia (fallback cuando una categoría no
 * tiene techo propio — ver categories.priorityCeiling y
 * src/lib/tickets/priority-triage.ts). Valida el valor contra el enum real
 * y lo pasa al service, igual que ya se hace en POST/PUT /api/categories.
 */

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }))
jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('@/lib/auth/module-config-access', () => ({
  canReadModuleFamilyConfig: jest.fn().mockResolvedValue(true),
  canWriteModuleFamilyConfig: jest.fn().mockResolvedValue(true),
  sanitizeTicketConfigBody: (body: Record<string, unknown>) => body,
}))

jest.mock('@/lib/services/ticket-family-config.service', () => ({
  TicketFamilyConfigService: {
    update: jest.fn().mockResolvedValue({ id: 'cfg-1', familyId: 'fam-1' }),
  },
}))

jest.mock('@/lib/api-cache', () => ({ invalidateCache: jest.fn().mockResolvedValue(undefined) }))

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}))

import { getServerSession } from 'next-auth'
import { TicketFamilyConfigService } from '@/lib/services/ticket-family-config.service'
import { PUT } from '@/app/api/families/[id]/ticket-config/route'

function params() {
  return { params: Promise.resolve({ id: 'fam-1' }) }
}

function req(body: Record<string, unknown>) {
  return { json: async () => body } as any
}

describe('PUT /api/families/[id]/ticket-config — priorityCeiling', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN', isSuperAdmin: false },
    })
  })

  it('valor válido → se pasa al service tal cual', async () => {
    const res = await PUT(req({ priorityCeiling: 'HIGH' }), params())

    expect(res.status).toBe(200)
    expect(TicketFamilyConfigService.update).toHaveBeenCalledWith(
      'fam-1',
      expect.objectContaining({ priorityCeiling: 'HIGH' }),
      'admin-1'
    )
  })

  it('null (quitar el techo de familia) → se pasa tal cual, sin rechazar', async () => {
    const res = await PUT(req({ priorityCeiling: null }), params())

    expect(res.status).toBe(200)
    expect(TicketFamilyConfigService.update).toHaveBeenCalledWith(
      'fam-1',
      expect.objectContaining({ priorityCeiling: null }),
      'admin-1'
    )
  })

  it('regresión: valor fuera del enum → 400, no llega al service', async () => {
    const res = await PUT(req({ priorityCeiling: 'ASAP' }), params())

    expect(res.status).toBe(400)
    expect(TicketFamilyConfigService.update).not.toHaveBeenCalled()
  })
})
