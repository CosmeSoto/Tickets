/**
 * Cuerpo compartido de las dos rutas que sirven un adjunto de noticia
 * (`/api/news/[id]/attachments/[attachmentId]/file` y su equivalente admin)
 * — antes casi idénticas letra por letra. Unificarlas evita que un fix de
 * seguridad se aplique en una y se olvide en la otra.
 *
 * Dos defensas además del guard de visibilidad:
 * - El `Content-Type` de la respuesta solo confía en `INLINE_SAFE_MIMES`; un
 *   adjunto legado con un `mimeType` peligroso en BD (de antes de este fix)
 *   se sirve como `application/octet-stream` + descarga forzada, nunca
 *   `inline` con un tipo que el navegador pueda ejecutar.
 * - `Content-Disposition` sale de `buildContentDisposition`, que sanea el
 *   nombre (sin comillas/CRLF/control chars) — antes se interpolaba
 *   `attachment.originalName` crudo en la cabecera.
 */
import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { assertCanViewNews } from '@/lib/news/news-access'
import { INLINE_SAFE_MIMES, buildContentDisposition } from '@/lib/files/upload-file-type'
import { FileService } from '@/lib/services/file-service'

export async function serveNewsAttachment(
  newsId: string,
  attachmentId: string,
  userId: string
): Promise<NextResponse> {
  const denied = await assertCanViewNews(newsId, userId, { allowManagerBypass: true })
  if (denied) {
    const status = denied.status
    return new NextResponse(
      status === 404 ? 'Noticia no encontrada' : 'No tienes acceso a esta noticia',
      { status }
    )
  }

  // findFirst con newsId en el where (no findUnique + comparación manual):
  // un adjunto de OTRA noticia nunca llega a leerse del disco.
  const attachment = await prisma.news_attachments.findFirst({
    where: { id: attachmentId, newsId },
  })
  if (!attachment) {
    return new NextResponse('Archivo no encontrado', { status: 404 })
  }

  const fileBuffer = await FileService.readAttachmentBytes(attachment)
  if (!fileBuffer) {
    return new NextResponse('Archivo no disponible', { status: 404 })
  }

  const inline = INLINE_SAFE_MIMES.has(attachment.mimeType)
  const contentType = inline ? attachment.mimeType : 'application/octet-stream'

  return new NextResponse(fileBuffer as BodyInit, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': buildContentDisposition(attachment.originalName, inline),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
