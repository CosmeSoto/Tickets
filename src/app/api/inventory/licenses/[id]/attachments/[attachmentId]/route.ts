import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { randomUUID } from 'crypto'

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
    return NextResponse.json({ error: 'No tienes permiso para eliminar este archivo' }, { status: 403 })
  }

  // Eliminar archivo físico (ignorar si ya no existe)
  try { await unlink(attachment.path) } catch { /* ignorar si ya no existe */ }

  await prisma.license_attachments.delete({ where: { id: attachmentId } })

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
