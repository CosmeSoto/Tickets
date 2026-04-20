import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getUploadDir } from '@/lib/upload-path'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]
const MAX_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * GET /api/inventory/equipment/[id]/attachments
 * Lista adjuntos de un equipo
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId } = await params

  const attachments = await prisma.equipment_attachments.findMany({
    where: { equipmentId },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(attachments)
}

/**
 * POST /api/inventory/equipment/[id]/attachments
 * Sube un adjunto a un equipo
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!await canManageInventory(session.user.id, session.user.role)) {
    return NextResponse.json({ error: 'No tienes permiso para gestionar el inventario' }, { status: 403 })
  }

  const { id: equipmentId } = await params

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } })
  if (!equipment) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 20MB' }, { status: 400 })
  }

  const uploadDir = getUploadDir('equipment', equipmentId)
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const filename = `${randomUUID()}.${ext}`
  const filepath = getUploadDir('equipment', equipmentId, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(filepath, buffer)

  const attachment = await prisma.equipment_attachments.create({
    data: {
      id: randomUUID(),
      equipmentId,
      filename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      path: filepath,
      uploadedBy: session.user.id,
      createdAt: new Date(),
    },
    include: { uploader: { select: { id: true, name: true } } },
  })

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'EQUIPMENT_ATTACHMENT_UPLOAD',
      entityType: 'equipment',
      entityId: equipmentId,
      userId: session.user.id,
      details: { descripcion: `Archivo adjunto "${file.name}" subido al equipo ${equipment.code}` },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
