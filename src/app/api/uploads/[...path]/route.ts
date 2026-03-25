import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getUploadDir } from '@/lib/upload-path'

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  pdf: 'application/pdf',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params

  // Sanitize: no path traversal
  if (segments.some(s => s.includes('..'))) {
    return new NextResponse('Not found', { status: 404 })
  }

  const relativePath = segments.join('/')
  const filePath = getUploadDir(relativePath)

  if (!existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  try {
    const buffer = await readFile(filePath)
    const ext = relativePath.split('.').pop()?.toLowerCase() || ''
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
