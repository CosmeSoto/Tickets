import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { FileService } from '@/lib/services/file-service'
import { INLINE_SAFE_MIMES, buildContentDisposition } from '@/lib/files/upload-file-type'

/**
 * GET /api/inventory/licenses/[id]/attachments/[attachmentId]
 * Descarga o previsualiza un adjunto
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: licenseId, attachmentId } = await params
  const isPreview = req.nextUrl.searchParams.get('preview') === 'true'

  const attachment = await prisma.license_attachments.findFirst({
    where: { id: attachmentId, licenseId },
  })
  if (!attachment) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const buffer = await FileService.readAttachmentBytes(attachment)
  if (!buffer) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }

  const inline = isPreview && INLINE_SAFE_MIMES.has(attachment.mimeType)
  const contentType = inline ? attachment.mimeType : 'application/octet-stream'

  return new NextResponse(buffer as BodyInit, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': buildContentDisposition(attachment.originalName, inline),
      'Content-Length': attachment.size.toString(),
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * DELETE /api/inventory/licenses/[id]/attachments/[attachmentId]
 * Elimina un adjunto de una licencia
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: licenseId, attachmentId } = await params

  const attachment = await prisma.license_attachments.findUnique({
    where: { id: attachmentId },
    include: { license: { select: { name: true } } },
  })
  if (!attachment) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const isAdmin = session.user.role === 'ADMIN'
  const isUploader = attachment.uploadedBy === session.user.id

  if (!isAdmin && !isUploader) {
    return NextResponse.json(
      { error: 'No tienes permiso para eliminar este archivo' },
      { status: 403 }
    )
  }

  await FileService.deleteLicenseFile(attachmentId)

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'LICENSE_ATTACHMENT_DELETE',
      entityType: 'software_license',
      entityId: licenseId,
      userId: session.user.id,
      details: { filename: attachment.originalName, licenseName: attachment.license.name },
      createdAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
