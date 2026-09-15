import '@testing-library/jest-dom'

// Polyfill for Next.js API routes
import { TextEncoder, TextDecoder } from 'util'

class MockRequest {
  constructor(input, options = {}) {
    const url = typeof input === 'string' ? input : input?.url || ''
    Object.defineProperty(this, 'url', { value: url, writable: false, enumerable: true })
    this.method = options.method || 'GET'
    this.headers = new Map(Object.entries(options.headers || {}))
    this.body = options.body
  }
}

class MockResponse {
  constructor(body, options = {}) {
    this._body = body
    this.status = options.status || 200
    this.headers = new Map(Object.entries(options.headers || {}))
  }

  static json(data, init = {}) {
    return new MockResponse(JSON.stringify(data), {
      status: init.status || 200,
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    })
  }

  async json() {
    if (typeof this._body === 'string') {
      try {
        return JSON.parse(this._body)
      } catch {
        return this._body
      }
    }
    return this._body
  }
}

Object.assign(global, {
  TextEncoder,
  TextDecoder,
  Request: MockRequest,
  Response: MockResponse,
})

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return new URLSearchParams()
  },
  usePathname() {
    return '/'
  },
}))

// Mock Next.js image
jest.mock('next/image', () => ({
  __esModule: true,
  // fill/priority/unoptimized/loader son props propias de next/image (no
  // atributos HTML válidos) — pasarlas tal cual a un <img> nativo genera
  // warnings de React ("Received `true` for a non-boolean attribute") en
  // cada test que renderiza una imagen con fill.
  default: ({
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    loader: _loader,
    ...props
  }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
// Antes se pisaba incondicionalmente, incluso si el invocador ya había
// exportado un DATABASE_URL real (p. ej. para correr
// code-generator.property.test.ts, el único archivo que usa el cliente de
// Prisma real en vez de mockearlo — necesita una base alcanzable). La
// mayoría de tests mockean '@/lib/prisma' y nunca leen este valor en
// runtime; el fallback solo cubre los casos que sí lo requieren en el
// import (p. ej. validación de config) cuando no se definió nada real.
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

// Mock console methods in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}
