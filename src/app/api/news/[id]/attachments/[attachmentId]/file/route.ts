/**
 * GET /api/news/[id]/attachments/[attachmentId]/file
 * Sirve el archivo adjunto de una noticia (ruta pública para usuarios autenticados con acceso a la noticia).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('No autorizado', { status: 401 })
    }

    const { id: newsId, attachmentId } = await params

    // Obtener la noticia con su información de acceso
    const news = await prisma.news.findUnique({
      where: { id: newsId },
      include: {
        news_roles: true,
        news_users: true,
        news_departments: true,
      },
    })

    if (!news) {
      return new NextResponse('Noticia no encontrada', { status: 404 })
    }

    // Verificar que el usuario tenga acceso a la noticia
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, departmentId: true, isSuperAdmin: true },
    })

    if (!user) {
      return new NextResponse('Usuario no encontrado', { status: 404 })
    }

    let hasAccess =
      news.news_roles.length === 0 &&
      news.news_users.length === 0 &&
      news.news_departments.length === 0

    if (!hasAccess) {
      hasAccess =
        user.isSuperAdmin ||
        news.news_roles.some(r => r.role === user.role) ||
        news.news_users.some(u => u.userId === user.id) ||
        (user.departmentId && news.news_departments.some(d => d.departmentId === user.departmentId))
    }

    if (!hasAccess) {
      return new NextResponse('No tienes acceso a esta noticia', { status: 403 })
    }

    // Obtener el attachment
    const attachment = await prisma.news_attachments.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment || attachment.newsId !== newsId) {
      return new NextResponse('Archivo no encontrado', { status: 404 })
    }

    // Verificar que el archivo existe en disco
    if (!existsSync(attachment.path)) {
      return new NextResponse('Archivo no disponible', { status: 404 })
    }

    const fileBuffer = await readFile(attachment.path)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Disposition': `inline; filename="${attachment.originalName}"`,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('[public-news-attachment-file] Error:', error)
    return new NextResponse('Error al servir archivo', { status: 500 })
  }
}
