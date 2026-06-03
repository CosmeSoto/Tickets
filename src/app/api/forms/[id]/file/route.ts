/**
 * API: User - Serve form file
 * GET /api/forms/[id]/file
 *
 * Sirve el archivo adjunto de un documento a cualquier usuario autenticado
 * con acceso al módulo de formularios. Soporta tanto archivos locales
 * (subidos al servidor) como URLs externas (redirect).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Obtener el form con su adjunto
    const form = await prisma.forms.findUnique({
      where: { id, isActive: true },
      include: {
        form_attachments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!form) {
      return new NextResponse('Not found', { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

    // ── Caso 1: tiene adjunto local ──────────────────────────────────────────
    if (form.form_attachments.length > 0) {
      const attachment = form.form_attachments[0]

      if (!existsSync(attachment.path)) {
        console.error(`[forms/file] Archivo no encontrado en disco: ${attachment.path}`)
        return new NextResponse('File not found on disk', { status: 404 })
      }

      const buffer = await readFile(attachment.path)

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': attachment.mimeType,
          'Content-Length': String(buffer.length),
          'Content-Disposition': download
            ? `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
            : `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      })
    }

    // ── Caso 2: tiene URL externa ────────────────────────────────────────────
    if (form.fileUrl) {
      // Si es una URL interna de admin, redirigir directamente
      if (form.fileUrl.startsWith('/api/admin/')) {
        // Leer el adjunto directamente desde la BD
        const attachmentId = form.fileUrl.split('/attachments/')[1]?.split('/')[0]
        if (attachmentId) {
          const attachment = await prisma.form_attachments.findUnique({
            where: { id: attachmentId },
          })
          if (attachment && existsSync(attachment.path)) {
            const buffer = await readFile(attachment.path)
            return new NextResponse(buffer, {
              headers: {
                'Content-Type': attachment.mimeType,
                'Content-Length': String(buffer.length),
                'Content-Disposition': download
                  ? `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
                  : `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
                'Cache-Control': 'private, max-age=3600',
              },
            })
          }
        }
      }

      // URL externa: redirect
      return NextResponse.redirect(form.fileUrl)
    }

    return new NextResponse('No file attached', { status: 404 })
  } catch (error) {
    console.error('Error sirviendo archivo de form:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
