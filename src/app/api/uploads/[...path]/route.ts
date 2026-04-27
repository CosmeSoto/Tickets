import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

// Prefijos de rutas que son públicas (no requieren autenticación)
const PUBLIC_PREFIXES = ['landing/', 'avatars/']

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  // Sanitize: no path traversal
  if (segments.some(s => s.includes('..'))) {
    return new NextResponse('Not found', { status: 404 })
  }

  const relativePath = segments.join('/')

  // Verificar si la ruta requiere autenticación
  const isPublic = PUBLIC_PREFIXES.some(prefix => relativePath.startsWith(prefix))

  if (!isPublic) {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }
  }

  const filePath = getUploadDir(relativePath)

  if (!existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const buffer = await readFile(filePath)
    const ext = relativePath.split('.').pop()?.toLowerCase() || ''
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    // Archivos públicos: cache largo. Privados: no cachear
    const cacheControl = isPublic
      ? 'public, max-age=31536000, immutable'
      : 'private, no-cache, no-store'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
