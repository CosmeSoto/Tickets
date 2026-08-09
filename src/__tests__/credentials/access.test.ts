import { EncryptionService } from '@/lib/services/encryption.service'
import {
  credentialsRoleRank,
  inferiorCredentialRoles,
} from '@/lib/credentials/access'

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
})
