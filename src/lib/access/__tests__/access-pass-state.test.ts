/**
 * access-pass-state — máquina de estados única para servidor y cliente.
 *
 * Antes de esta centralización, el cliente (`effectivePassLabel` en
 * access-console.tsx) reimplementaba su propia precedencia, distinta de la que
 * usa el escáner (`resolveAccessPassState`): evaluaba vencimiento antes que
 * SUSPENDED/PENDING_PRIVACY, y el estado del sujeto al final. El primer bloque
 * de tests fija la precedencia real y verifica que `resolveAccessPassDisplayState`
 * (lo que debe consumir la UI) nunca diverge de `resolveAccessPassState` (lo que
 * usa el escáner) salvo por el refinamiento "por vencer" sobre VALID.
 *
 * El segundo bloque (`assertAccessStatusTransition`) es la regresión directa del
 * bug de seguridad real: el PATCH de gestión permitía `PENDING_PRIVACY → ACTIVE`
 * sin que la persona hubiera aceptado el aviso de privacidad — bypass completo
 * del consentimiento. El test "bloquea activar sin consentimiento" es el que
 * habría atrapado ese bug antes de llegar a producción.
 */

import {
  ACCESS_SCAN_MESSAGES,
  ACCESS_SCAN_RESULTS,
  ACCESS_SCAN_RESULT_BADGES,
  ACCESS_STATE_BADGES,
  assertAccessStatusTransition,
  resolveAccessPassDisplayState,
  resolveAccessPassState,
  type AccessPassStateInput,
} from '../access-pass-state'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function pass(overrides: Partial<AccessPassStateInput> = {}): AccessPassStateInput {
  const now = Date.now()
  return {
    status: 'ACTIVE',
    validFrom: new Date(now - DAY),
    validUntil: new Date(now + DAY),
    subject: { isActive: true },
    ...overrides,
  }
}

describe('resolveAccessPassState — precedencia', () => {
  it('sujeto inactivo gana sobre cualquier otro estado, incluido REVOKED', () => {
    expect(resolveAccessPassState(pass({ status: 'REVOKED', subject: { isActive: false } }))).toBe(
      'INACTIVE_SUBJECT'
    )
  })

  it('REVOKED gana sobre PENDING_PRIVACY/SUSPENDED y sobre la ventana de vigencia', () => {
    expect(resolveAccessPassState(pass({ status: 'REVOKED' }))).toBe('REVOKED')
    expect(
      resolveAccessPassState(pass({ status: 'REVOKED', validUntil: new Date(Date.now() - DAY) }))
    ).toBe('REVOKED')
  })

  it('PENDING_PRIVACY gana sobre SUSPENDED y sobre la ventana de vigencia', () => {
    expect(resolveAccessPassState(pass({ status: 'PENDING_PRIVACY' }))).toBe('PENDING_PRIVACY')
  })

  it('SUSPENDED gana sobre la ventana de vigencia', () => {
    expect(
      resolveAccessPassState(pass({ status: 'SUSPENDED', validUntil: new Date(Date.now() - DAY) }))
    ).toBe('SUSPENDED')
  })

  it('distingue NOT_YET_VALID de EXPIRED', () => {
    expect(resolveAccessPassState(pass({ validFrom: new Date(Date.now() + DAY) }))).toBe(
      'NOT_YET_VALID'
    )
    expect(resolveAccessPassState(pass({ validUntil: new Date(Date.now() - DAY) }))).toBe('EXPIRED')
  })

  it('VALID solo cuando todo lo demás está en orden', () => {
    expect(resolveAccessPassState(pass())).toBe('VALID')
  })
})

describe('resolveAccessPassDisplayState — paridad con el escáner', () => {
  const cases: Array<[string, AccessPassStateInput]> = [
    ['sujeto inactivo', pass({ subject: { isActive: false } })],
    ['revocado', pass({ status: 'REVOKED' })],
    ['pendiente de privacidad', pass({ status: 'PENDING_PRIVACY' })],
    ['suspendido', pass({ status: 'SUSPENDED' })],
    ['programado', pass({ validFrom: new Date(Date.now() + DAY) })],
    ['vencido', pass({ validUntil: new Date(Date.now() - DAY) })],
    // Sujeto inactivo + vencido + suspendido: debe ganar INACTIVE_SUBJECT en ambos,
    // no "EXPIRADO" como hacía la implementación vieja del cliente.
    [
      'combinación: inactivo + suspendido + vencido',
      pass({
        status: 'SUSPENDED',
        subject: { isActive: false },
        validUntil: new Date(Date.now() - DAY),
      }),
    ],
  ]

  it.each(cases)('%s: el estado base coincide exactamente con el del escáner', (_desc, input) => {
    const display = resolveAccessPassDisplayState(input)
    const scanner = resolveAccessPassState(input)
    // Fuera del caso VALID, deben ser idénticos — ninguna divergencia posible.
    if (scanner !== 'VALID') {
      expect(display).toBe(scanner)
    }
  })

  it('refina VALID a EXPIRING_SOON dentro de las 24h previas al vencimiento', () => {
    expect(
      resolveAccessPassDisplayState(pass({ validUntil: new Date(Date.now() + 12 * HOUR) }))
    ).toBe('EXPIRING_SOON')
  })

  it('mantiene VALID cuando falta más de 24h para vencer', () => {
    expect(
      resolveAccessPassDisplayState(pass({ validUntil: new Date(Date.now() + 3 * DAY) }))
    ).toBe('VALID')
  })
})

describe('assertAccessStatusTransition — cierre del bypass de consentimiento', () => {
  it('bloquea activar un pase PENDING_PRIVACY sin consentimiento (el bug original)', () => {
    const result = assertAccessStatusTransition('PENDING_PRIVACY', 'ACTIVE', {
      hasPrivacyAcceptance: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONSENT_REQUIRED')
  })

  it('sigue bloqueando aunque hasPrivacyAcceptance venga true por error si el pase nunca aceptó (defensa en profundidad la hace la ruta, no esta función) — pero si el llamador pasa el dato correcto, permite', () => {
    // Esta función confía en el flag que le pasa el caller (la ruta lee
    // `privacyAcceptedAt` de la fila real) — aquí solo se prueba que, dado el
    // flag correcto, la decisión es la esperada.
    const result = assertAccessStatusTransition('PENDING_PRIVACY', 'ACTIVE', {
      hasPrivacyAcceptance: true,
    })
    expect(result.ok).toBe(true)
  })

  it('permite revocar un pase PENDING_PRIVACY (flujo ya usado por la consola)', () => {
    expect(assertAccessStatusTransition('PENDING_PRIVACY', 'REVOKED').ok).toBe(true)
  })

  it('bloquea reactivar un REVOKED sin reissueQr', () => {
    const result = assertAccessStatusTransition('REVOKED', 'ACTIVE', {
      reissueQr: false,
      hasPrivacyAcceptance: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('REVOKED_NEEDS_REISSUE')
  })

  it('bloquea reactivar un REVOKED con reissueQr pero sin consentimiento previo', () => {
    const result = assertAccessStatusTransition('REVOKED', 'ACTIVE', {
      reissueQr: true,
      hasPrivacyAcceptance: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONSENT_REQUIRED')
  })

  it('permite reactivar un REVOKED con reissueQr y consentimiento previo', () => {
    expect(
      assertAccessStatusTransition('REVOKED', 'ACTIVE', {
        reissueQr: true,
        hasPrivacyAcceptance: true,
      }).ok
    ).toBe(true)
  })

  it('permite SUSPENDED → ACTIVE cuando ya hubo consentimiento', () => {
    expect(
      assertAccessStatusTransition('SUSPENDED', 'ACTIVE', { hasPrivacyAcceptance: true }).ok
    ).toBe(true)
  })

  it('bloquea SUSPENDED → ACTIVE si por algún motivo nunca hubo consentimiento', () => {
    const result = assertAccessStatusTransition('SUSPENDED', 'ACTIVE', {
      hasPrivacyAcceptance: false,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('CONSENT_REQUIRED')
  })

  it('ACTIVE → SUSPENDED no requiere ningún flag adicional', () => {
    expect(assertAccessStatusTransition('ACTIVE', 'SUSPENDED').ok).toBe(true)
  })

  it('no-op (mismo status) siempre se permite', () => {
    expect(assertAccessStatusTransition('ACTIVE', 'ACTIVE').ok).toBe(true)
    expect(assertAccessStatusTransition('PENDING_PRIVACY', 'PENDING_PRIVACY').ok).toBe(true)
  })
})

describe('coherencia de catálogos', () => {
  it('ACCESS_SCAN_MESSAGES cubre todas las claves de ACCESS_SCAN_RESULTS', () => {
    for (const key of ACCESS_SCAN_RESULTS) {
      expect(ACCESS_SCAN_MESSAGES[key]).toBeDefined()
    }
  })

  it('ACCESS_SCAN_RESULT_BADGES cubre exactamente las claves de ACCESS_SCAN_RESULTS', () => {
    expect(Object.keys(ACCESS_SCAN_RESULT_BADGES).sort()).toEqual([...ACCESS_SCAN_RESULTS].sort())
  })

  it('ACCESS_STATE_BADGES cubre todos los estados posibles de resolveAccessPassDisplayState', () => {
    const displayStates = [
      ...ACCESS_SCAN_RESULTS.filter(r => r !== 'NOT_FOUND' && r !== 'OUT_OF_SCOPE'),
      'EXPIRING_SOON',
    ]
    expect(Object.keys(ACCESS_STATE_BADGES).sort()).toEqual([...new Set(displayStates)].sort())
  })
})
