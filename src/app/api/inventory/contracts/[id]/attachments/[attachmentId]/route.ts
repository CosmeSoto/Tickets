import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { FileService } from '@/lib/services/file-service'
import { INLINE_SAFE_MIMES, buildContentDisposition } from '@/lib/files/upload-file-type'
import {
  assertInventoryResourceRead,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/contracts/[id]/attachments/[attachmentId]
 * Descarga o previsualiza un adjunto de contrato.
 *
 * Antes el frontend leía `attachment.path` directamente (vía
 * `toPublicUploadUrl`) — servía cualquier adjunto de contrato a cualquier
 * usuario logueado, sin verificar scope de familia sobre ESE contrato (a
 * diferencia de equipos/licencias, que ya pasaban por una ruta autenticada
 * y con scope). Esta ruta cierra ese hueco y además es la única forma de
 * servir un adjunto que terminó en la nube (Google Drive/OneDrive) en vez
 * de disco.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: contractId, attachmentId } = await params

  try {
    await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'CONTRACT', contractId)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const isPreview = req.nextUrl.searchParams.get('preview') === 'true'

  const attachment = await prisma.contract_attachments.findFirst({
    where: { id: attachmentId, contractId },
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
