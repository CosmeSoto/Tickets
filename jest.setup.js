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
  default: props => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock environment variables
process.env.NEXTAUTH_SECRET = 'test-secret'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

// Mock console methods in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
}
