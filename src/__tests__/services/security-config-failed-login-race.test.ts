/**
 * SecurityConfigService.recordFailedLogin
 *
 * El contador de intentos fallidos (usado por `isAccountLocked` para el
 * bloqueo temporal de cuenta) se guardaba como blob JSON en `system_settings`
 * con un ciclo lectura-modificación-escritura sin ningún guard. Ante intentos
 * de login concurrentes contra la misma cuenta — justo el escenario de
 * fuerza bruta que este contador busca frenar — varias peticiones podían leer
 * el mismo `attempts` antes de que ninguna escribiera, perdiéndose
 * incrementos ("lost update") y debilitando el umbral real de bloqueo.
 *
 * Fix: compare-and-swap vía `updateMany({ where: { key, value: <leído> } })`
 * + reintento si `count === 0` (otra petición ganó la escritura primero).
 */

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    system_settings: {
      findMany: jest.fn().mockResolvedValue([]), // getConfig() usa defaults
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/notifications/security-telegram', () => ({
  notifySuperAdminsSecurityAlert: jest.fn().mockResolvedValue(undefined),
}))

import prisma from '@/lib/prisma'
import { SecurityConfigService } from '@/lib/services/security-config-service'

const EMAIL = 'victim@x.com'
const KEY = `failed_login:${EMAIL}`

describe('SecurityConfigService.recordFailedLogin — incremento bajo concurrencia', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    SecurityConfigService.clearCache()
  })

  it('regresión: si la primera escritura pierde la carrera (count 0), reintenta con el valor fresco en vez de perder el incremento', async () => {
    const staleRecord = { key: KEY, value: JSON.stringify({ attempts: 1, lastAttempt: 1000 }) }
    const freshRecord = { key: KEY, value: JSON.stringify({ attempts: 2, lastAttempt: 2000 }) }

    ;(prisma.system_settings.findUnique as jest.Mock)
      .mockResolvedValueOnce(staleRecord) // primera lectura: alguien más ya escribió después de esta
      .mockResolvedValueOnce(freshRecord) // reintento: lee el valor actualizado
    ;(prisma.system_settings.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 0 }) // el guard sobre `value: staleRecord.value` no matchea más → perdió la carrera
      .mockResolvedValueOnce({ count: 1 }) // reintento con el valor fresco: gana

    await SecurityConfigService.recordFailedLogin(EMAIL, '1.2.3.4')

    expect(prisma.system_settings.updateMany).toHaveBeenCalledTimes(2)
    // La segunda escritura parte de `freshRecord` (attempts: 2), no del valor stale
    const secondCallData = JSON.parse(
      (prisma.system_settings.updateMany as jest.Mock).mock.calls[1][0].data.value
    )
    expect(secondCallData.attempts).toBe(3)
  })

  it('escritura sin contención: incrementa en el primer intento, sin reintentos', async () => {
    const record = { key: KEY, value: JSON.stringify({ attempts: 0, lastAttempt: 0 }) }
    ;(prisma.system_settings.findUnique as jest.Mock).mockResolvedValue(record)
    ;(prisma.system_settings.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

    await SecurityConfigService.recordFailedLogin(EMAIL, '1.2.3.4')

    expect(prisma.system_settings.updateMany).toHaveBeenCalledTimes(1)
    expect(prisma.system_settings.updateMany).toHaveBeenCalledWith({
      where: { key: KEY, value: record.value },
      data: { value: expect.any(String) },
    })
  })
})
