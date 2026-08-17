import { inlineDataImagesForEmail } from '@/lib/services/email/email-inline-images'

describe('inlineDataImagesForEmail', () => {
  it('convierte data URI a cid y genera adjunto descargable', () => {
    const png = Buffer.alloc(64, 1).toString('base64')
    const html = `<p>QR</p><img alt="Código QR de acceso" src="data:image/png;base64,${png}" />`

    const result = inlineDataImagesForEmail(html)

    expect(result.html).toContain('cid:img-1@tickets')
    expect(result.html).not.toContain('data:image/png')
    expect(result.attachments).toHaveLength(2)
    expect(result.attachments[0].cid).toBe('img-1@tickets')
    expect(result.attachments[0].contentDisposition).toBe('inline')
    expect(result.attachments[1].contentDisposition).toBe('attachment')
    expect(String(result.attachments[1].filename)).toMatch(/codigo-qr|Codigo-QR|codigo-QR/i)
  })

  it('deja el html intacto si no hay data URI', () => {
    const html = '<p>Sin imagen</p>'
    const result = inlineDataImagesForEmail(html)
    expect(result.html).toBe(html)
    expect(result.attachments).toHaveLength(0)
  })
})
