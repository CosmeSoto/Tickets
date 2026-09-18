/**
 * Cuerpo compartido para servir un adjunto de documento (`forms`), paralelo a
 * `src/lib/news/serve-news-attachment.ts`. Antes cada ruta (`admin/forms/[id]/
 * attachments/[attachmentId]/file` y las dos ramas locales de
 * `forms/[id]/file`) repetía el mismo código y confiaba en `attachment.mimeType`
 * tal cual — un valor que, antes del fix de `FileService.uploadFormFile`,
 * podía ser cualquier cosa declarada por el cliente.
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
import { assertCanViewForm } from '@/lib/forms/form-visibility'
import { INLINE_SAFE_MIMES, buildContentDisposition } from '@/lib/files/upload-file-type'
import { FileService } from '@/lib/services/file-service'

/**
 * Lee los bytes de un adjunto sin importar dónde vive — disco local o nube.
 * Delega en `FileService.readAttachmentBytes` (única fuente de verdad,
 * reusada también por `src/lib/news/serve-news-attachment.ts`).
 */
export const readFormAttachmentBuffer = FileService.readAttachmentBytes.bind(FileService)

/** Arma la respuesta HTTP de un adjunto ya cargado (sin volver a tocar BD). */
export function buildFormAttachmentResponse(
  attachment: { path: string | null; mimeType: string; originalName: string },
  buffer: Uint8Array,
  download: boolean
): NextResponse {
  const inline = !download && INLINE_SAFE_MIMES.has(attachment.mimeType)
  const contentType = inline ? attachment.mimeType : 'application/octet-stream'

  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': buildContentDisposition(attachment.originalName, inline),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function serveFormAttachment(
  formId: string,
  attachmentId: string,
  userId: string,
  download: boolean
): Promise<NextResponse> {
  const denied = await assertCanViewForm(formId, userId)
  if (denied) {
    return new NextResponse(denied.status === 404 ? 'Documento no encontrado' : 'Sin acceso', {
      status: denied.status,
    })
  }

  // findFirst con formId en el where (no findUnique + comparación manual):
  // un adjunto de OTRO documento nunca llega a leerse del disco.
  const attachment = await prisma.form_attachments.findFirst({
    where: { id: attachmentId, formId },
  })
  if (!attachment) {
    return new NextResponse('Archivo no encontrado', { status: 404 })
  }

  const buffer = await readFormAttachmentBuffer(attachment)
  if (!buffer) {
    return new NextResponse('Archivo no disponible', { status: 404 })
  }

  return buildFormAttachmentResponse(attachment, buffer, download)
}
