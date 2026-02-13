/**
 * Service Worker API Route
 * 
 * Serves the service worker for asset caching
 */

import { NextRequest, NextResponse } from 'next/server'
import { StaticAssetMiddleware } from '@/lib/cdn/static-asset-middleware'
import { ApplicationLogger } from '@/lib/logging'

export async function GET(request: NextRequest) {
  const timer = ApplicationLogger.timer('serve_service_worker', {
    component: 'service-worker-api',
    metadata: { userAgent: request.headers.get('user-agent') }
  })

  try {
    // Generate service worker content
    const serviceWorkerContent = StaticAssetMiddleware.generateServiceWorker()

    // Set appropriate headers
    const headers = new Headers({
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Service-Worker-Allowed': '/',
      'X-Content-Type-Options': 'nosniff'
    })

    ApplicationLogger.businessOperation('serve_service_worker', 'service-worker-api', 'asset', {
      metadata: { 
        contentLength: serviceWorkerContent.length,
        duration: timer.end()
      }
    })

    return new NextResponse(serviceWorkerContent, {
      status: 200,
      headers
    })

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    ApplicationLogger.systemHealth('service-worker-api', 'unhealthy', {
      error: err.message
    })
    timer.end('Service worker serving failed')

    return new NextResponse('Service Worker Error', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    })
  }
}

// Only allow GET method
export async function POST() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}

export async function PUT() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}

export async function DELETE() {
  return new NextResponse('Method Not Allowed', { status: 405 })
}