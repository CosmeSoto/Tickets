import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import { FileService } from '@/lib/services/file-service'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params = await context.params

  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return inventoryForbidden()
  }

  const contract = await prisma.contracts.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!contract) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  let attachment
  try {
    attachment = await FileService.uploadContractFile({
      file,
      contractId: params.id,
      uploadedBy: session.user.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al subir el archivo' },
      { status: 400 }
    )
  }

  await createAuditLog({
    entityType: 'contract',
    entityId: params.id,
    action: 'contract_attachment_uploaded',
    userId: session.user.id,
    changes: { filename: file.name, size: file.size },
  })

  return NextResponse.json(attachment, { status: 201 })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const params = await context.params

  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return inventoryForbidden()
  }

  const attachmentId = new URL(req.url).searchParams.get('attachmentId')
  if (!attachmentId) return NextResponse.json({ error: 'attachmentId requerido' }, { status: 400 })

  const attachment = await prisma.contract_attachments.findFirst({
    where: { id: attachmentId, contractId: params.id },
  })
  if (!attachment) return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })

  // Antes solo se borraba la fila — el archivo físico quedaba huérfano en
  // disco para siempre. `deleteContractFile` también limpia disco/nube.
  await FileService.deleteContractFile(attachmentId)

  await createAuditLog({
    entityType: 'contract',
    entityId: params.id,
    action: 'contract_attachment_deleted',
    userId: session.user.id,
    changes: { filename: attachment.originalName },
  })

  return NextResponse.json({ success: true })
}
