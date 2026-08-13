import { verifyCronAuth } from '@/lib/cron/verify-cron-auth'

describe('verifyCronAuth', () => {
  const originalSecret = process.env.CRON_SECRET

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalSecret
    }
  })

  it('rechaza si CRON_SECRET no está configurado', () => {
    delete process.env.CRON_SECRET
    const req = new Request('http://localhost/api/cron/test')
    const res = verifyCronAuth(req)
    expect(res?.status).toBe(503)
  })

  it('acepta Authorization Bearer', () => {
    process.env.CRON_SECRET = 'test-secret'
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer test-secret' },
    })
    expect(verifyCronAuth(req)).toBeNull()
  })

  it('acepta ?secret= en query (compatibilidad legacy)', () => {
    process.env.CRON_SECRET = 'test-secret'
    const req = new Request('http://localhost/api/cron/test?secret=test-secret')
    expect(verifyCronAuth(req)).toBeNull()
  })

  it('rechaza credenciales inválidas', () => {
    process.env.CRON_SECRET = 'test-secret'
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(verifyCronAuth(req)?.status).toBe(401)
  })
})
