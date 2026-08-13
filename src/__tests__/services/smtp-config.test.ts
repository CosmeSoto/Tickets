import {
  isAllowedSmtpHost,
  isMicrosoftSmtpHost,
  resolveSmtpSecure,
  validateEnabledEmailSettings,
} from '@/lib/email/smtp-settings-validation'

describe('resolveSmtpSecure', () => {
  it('fuerza SSL en puerto 465', () => {
    expect(resolveSmtpSecure(465, false)).toBe(true)
  })

  it('fuerza STARTTLS (secure=false) en puerto 587', () => {
    expect(resolveSmtpSecure(587, true)).toBe(false)
  })
})

describe('isMicrosoftSmtpHost', () => {
  it('reconoce hosts Microsoft', () => {
    expect(isMicrosoftSmtpHost('smtp-mail.outlook.com')).toBe(true)
    expect(isMicrosoftSmtpHost('smtp.office365.com')).toBe(true)
    expect(isMicrosoftSmtpHost('smtp.gmail.com')).toBe(false)
  })
})

describe('validateEnabledEmailSettings', () => {
  it('rechaza host no admitido', () => {
    expect(
      validateEnabledEmailSettings({
        smtpHost: 'mail.example.com',
        smtpUser: 'a@b.com',
        hasStoredPassword: true,
      })
    ).toMatch(/no admitido/)
  })

  it('acepta Gmail con contraseña guardada', () => {
    expect(
      validateEnabledEmailSettings({
        smtpHost: 'smtp.gmail.com',
        smtpUser: 'a@gmail.com',
        hasStoredPassword: true,
      })
    ).toBeNull()
  })
})

describe('isAllowedSmtpHost', () => {
  it('solo permite Gmail y Microsoft', () => {
    expect(isAllowedSmtpHost('smtp.gmail.com')).toBe(true)
    expect(isAllowedSmtpHost('smtp.office365.com')).toBe(true)
    expect(isAllowedSmtpHost('smtp.other.com')).toBe(false)
  })
})
