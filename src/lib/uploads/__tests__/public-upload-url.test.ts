import { toPublicUploadUrl } from '../public-upload-url'

describe('toPublicUploadUrl', () => {
  it('reescribe /uploads/... a /api/uploads/...', () => {
    expect(toPublicUploadUrl('/uploads/news/n1/x.pdf')).toBe('/api/uploads/news/n1/x.pdf')
  })

  it('deja intacta una URL que no empieza con /uploads/', () => {
    expect(toPublicUploadUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png')
    expect(toPublicUploadUrl('/api/uploads/landing/logo.png')).toBe('/api/uploads/landing/logo.png')
  })

  it('devuelve null para valores vacíos', () => {
    expect(toPublicUploadUrl(null)).toBeNull()
    expect(toPublicUploadUrl(undefined)).toBeNull()
    expect(toPublicUploadUrl('')).toBeNull()
  })
})
