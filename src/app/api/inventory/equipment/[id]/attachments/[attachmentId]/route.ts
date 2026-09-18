import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  assertInventoryResourceRead,
  assertInventoryResourceManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { INLINE_SAFE_MIMES, buildContentDisposition } from '@/lib/files/upload-file-type'
import { FileService } from '@/lib/services/file-service'

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

  const { id: equipmentId, attachmentId } = await params

  try {
    await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'EQUIPMENT', equipmentId)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const isPreview = req.nextUrl.searchParams.get('preview') === 'true'

  const attachment = await prisma.equipment_attachments.findFirst({
    where: { id: attachmentId, equipmentId },
  })
  if (!attachment) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  const buffer = await FileService.readAttachmentBytes(attachment)
  if (!buffer) {
    return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
  }
  // El `mimeType` guardado en BD puede venir de un adjunto legado subido antes
  // de validar por contenido real — nunca se confía en él para decidir
  // `inline`: solo se sirve embebido si está en la allowlist, si no se fuerza
  // descarga con `application/octet-stream` (mismo criterio que Tickets/
  // Noticias/Documentos esta sesión).
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
 * DELETE /api/inventory/equipment/[id]/attachments/[attachmentId]
 * Elimina un adjunto
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId, attachmentId } = await params

  // `canManageInventory` es un permiso GLOBAL (documentado así en
  // inventory-access.ts) — un gestor de la familia "Vehículos" lo tiene en
  // true igual que uno de "TI", así que por sí solo no impedía borrar
  // adjuntos de equipos de una familia que no administra. `assertInventory
  // ResourceManage` exige además el scope real por familia del equipo.
  try {
    await assertInventoryResourceManage(
      toInventoryAccessUser(session.user),
      'EQUIPMENT',
      equipmentId
    )
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const attachment = await prisma.equipment_attachments.findFirst({
    where: { id: attachmentId, equipmentId },
    include: { equipment: { select: { code: true } } },
  })
  if (!attachment) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  await FileService.deleteEquipmentFile(attachmentId)

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_ATTACHMENT_DELETE',
      entityType: 'equipment',
      entityId: equipmentId,
      userId: session.user.id,
      details: {
        descripcion: `Archivo adjunto "${attachment.originalName}" eliminado del equipo ${attachment.equipment.code}`,
      },
      createdAt: new Date(),
    },
  })

  return NextResponse.json({ success: true })
}
