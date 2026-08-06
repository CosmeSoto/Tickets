import { EncryptionService } from '@/lib/services/encryption.service'

describe('credentials encryption (MVP)', () => {
  it('round-trip AES-GCM para secretos de bóveda', () => {
    const secret = 'P@ssw0rd-área-técnica-ñ'
    const encrypted = EncryptionService.encrypt(secret)
    expect(encrypted).toContain(':')
    expect(encrypted).not.toContain(secret)
    expect(EncryptionService.decrypt(encrypted)).toBe(secret)
  })
})
