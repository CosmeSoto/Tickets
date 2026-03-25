import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { unlink, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'

/**
 * GET /api/inventory/equipment/[id]/attachments/[attachmentId]
 * Descarga o previsualiza un adjunto
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { attachmentId } = await params
  const isPreview = req.nextUrl.searchParams.get('preview') === 'true'

  const attachment = await prisma.equipment_attachments.findUnique({ where: { id: attachmentId } })
  if (!attachment) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  if (!existsSync(attachment.path)) {
    return NextResponse.json({ error: 'Archivo no disponible en el servidor' }, { status: 404 })
  }

  const buffer = await readFile(attachment.path)
  const disposition = isPreview ? 'inline' : 'attachment'

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(attachment.originalName)}"`,
      'Content-Length': attachment.size.toString(),
    },
  })
}

/**
 * DELETE /api/inventory/equipment/[id]/attachments/[attachmentId]
 * Elimina un adjunto
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el inventario' }, { status: 403 })
  }

  const { id: equipmentId, attachmentId } = await params

  const attachment = await prisma.equipment_attachments.findUnique({
    where: { id: attachmentId },
    include: { equipment: { select: { code: true } } },
  })
  if (!attachment) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  // Eliminar archivo físico
  try { await unlink(attachment.path) } catch { /* ignorar si ya no existe */ }

  await prisma.equipment_attachments.delete({ where: { id: attachmentId } })

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_ATTACHMENT_DELETE',
      entityType: 'equipment',
      entityId: equipmentId,
      userId: session.user.id,
      descripcion: `Archivo adjunto "${attachment.originalName}" eliminado del equipo ${attachment.equipment.code}`,
      createdAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
