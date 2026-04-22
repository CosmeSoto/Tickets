import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { createAuditLog } from '@/lib/audit'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

type Params = { params: { id: string } }

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'public', 'uploads')
const DEFAULT_MAX_MB = 10

async function getMaxFileSizeMB(): Promise<number> {
  try {
    const setting = await prisma.system_settings.findUnique({ where: { key: 'maxFileSize' } })
    return setting ? parseInt(setting.value) || DEFAULT_MAX_MB : DEFAULT_MAX_MB
  } catch {
    return DEFAULT_MAX_MB
  }
}

// POST /api/contracts/[id]/attachments — subir adjunto
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return inventoryForbidden()
  }

  const contract = await prisma.contracts.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!contract) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  const maxMB = await getMaxFileSizeMB()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

  if (file.size > maxMB * 1024 * 1024) {
    return NextResponse.json({ error: `El archivo supera el límite de ${maxMB}MB configurado en el sistema` }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const filename = `contract_${params.id}_${Date.now()}.${ext}`
  const dir = join(UPLOAD_DIR, 'contracts', params.id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), Buffer.from(await file.arrayBuffer()))

  const attachment = await prisma.contract_attachments.create({
    data: {
      id:           randomUUID(),
      contractId:   params.id,
      filename,
      originalName: file.name,
      mimeType:     file.type,
      size:         file.size,
      path:         `/uploads/contracts/${params.id}/${filename}`,
      uploadedBy:   session.user.id,
    },
  })

  await createAuditLog({
    entityType: 'contract',
    entityId:   params.id,
    action:     'contract_attachment_uploaded',
    userId:     session.user.id,
    changes:    { filename: file.name, size: file.size },
  })

  return NextResponse.json(attachment, { status: 201 })
}

// DELETE /api/contracts/[id]/attachments?attachmentId=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return inventoryForbidden()
  }

  const attachmentId = new URL(req.url).searchParams.get('attachmentId')
  if (!attachmentId) return NextResponse.json({ error: 'attachmentId requerido' }, { status: 400 })

  const attachment = await prisma.contract_attachments.findFirst({
    where: { id: attachmentId, contractId: params.id },
  })
  if (!attachment) return NextResponse.json({ error: 'Adjunto no encontrado' }, { status: 404 })

  await prisma.contract_attachments.delete({ where: { id: attachmentId } })

  await createAuditLog({
    entityType: 'contract',
    entityId:   params.id,
    action:     'contract_attachment_deleted',
    userId:     session.user.id,
    changes:    { filename: attachment.originalName },
  })

  return NextResponse.json({ success: true })
}
