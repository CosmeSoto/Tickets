import { EncryptionService } from '@/lib/services/encryption.service'
import { credentialsRoleRank, inferiorCredentialRoles } from '@/lib/credentials/access'
import { isAllowedCredentialShareTarget } from '@/lib/credentials/share-scope'

describe('credentials encryption (MVP)', () => {
  it('round-trip AES-GCM para secretos de bóveda', () => {
    const secret = 'P@ssw0rd-área-técnica-ñ'
    const encrypted = EncryptionService.encrypt(secret)
    expect(encrypted).toContain(':')
    expect(encrypted).not.toContain(secret)
    expect(EncryptionService.decrypt(encrypted)).toBe(secret)
  })
})

describe('credentials hierarchy ranks', () => {
  it('Admin no SuperAdmin no ve pares ni superiores', () => {
    expect(credentialsRoleRank('ADMIN', false)).toBe(3)
    expect(inferiorCredentialRoles('ADMIN', false)).toEqual(['TECHNICIAN', 'CLIENT'])
  })

  it('Técnico solo gestiona clientes inferiores', () => {
    expect(inferiorCredentialRoles('TECHNICIAN', false)).toEqual(['CLIENT'])
  })

  it('Cliente no tiene jerarquía hacia abajo', () => {
    expect(inferiorCredentialRoles('CLIENT', false)).toEqual([])
  })
})

describe('credentials share rank', () => {
  it('cliente puede compartir hacia técnico o admin (no SuperAdmin)', () => {
    const client = { role: 'CLIENT', isSuperAdmin: false }
    expect(
      isAllowedCredentialShareTarget(client, { role: 'TECHNICIAN', isSuperAdmin: false })
    ).toBe(true)
    expect(isAllowedCredentialShareTarget(client, { role: 'ADMIN', isSuperAdmin: false })).toBe(
      true
    )
    expect(isAllowedCredentialShareTarget(client, { role: 'ADMIN', isSuperAdmin: true })).toBe(
      false
    )
  })

  it('técnico puede compartir hacia admin y hacia cliente', () => {
    const tech = { role: 'TECHNICIAN', isSuperAdmin: false }
    expect(isAllowedCredentialShareTarget(tech, { role: 'ADMIN', isSuperAdmin: false })).toBe(true)
    expect(isAllowedCredentialShareTarget(tech, { role: 'CLIENT', isSuperAdmin: false })).toBe(true)
  })

  it('SuperAdmin puede compartir con cualquiera', () => {
    const sa = { role: 'ADMIN', isSuperAdmin: true }
    expect(isAllowedCredentialShareTarget(sa, { role: 'ADMIN', isSuperAdmin: true })).toBe(true)
    expect(isAllowedCredentialShareTarget(sa, { role: 'CLIENT', isSuperAdmin: false })).toBe(true)
  })
})
