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
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getUploadDir } from '@/lib/upload-path'
import {
  resolveSafeUploadMime,
  EXT_BY_MIME,
  sanitizeOriginalFilename,
} from '@/lib/files/upload-file-type'

/**
 * GET /api/inventory/equipment/[id]/attachments
 * Lista adjuntos de un equipo
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId } = await params

  try {
    await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'EQUIPMENT', equipmentId)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

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
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: equipmentId } = await params

  // `canManageInventory` por sí solo es un permiso GLOBAL (cualquier gestor
  // de cualquier familia lo tiene en true) — `assertInventoryResourceManage`
  // exige además el scope real de familia sobre ESTE equipo.
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

  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId } })
  if (!equipment) return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  const { SecurityConfigService } = await import('@/lib/services/security-config-service')
  const sizeCheck = await SecurityConfigService.validateFileSize(file.size)
  if (!sizeCheck.valid) {
    return NextResponse.json({ error: sizeCheck.message }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Tipo de archivo por CONTENIDO real (magic bytes), no por el Content-Type
  // que declara el cliente (trivialmente falsificable) — antes solo se
  // sniffeaba el contenido real para imágenes; un .pdf/.doc/.xls declarado
  // pasaba sin verificar, y se servía de vuelta con ese mismo mimeType sin
  // validar (ver el fix del GET de adjunto individual). Mismo pipeline ya
  // usado en Noticias/Documentos/Tickets/Usuarios esta sesión.
  const detectedMime = resolveSafeUploadMime(buffer, file.type)
  if (!detectedMime) {
    return NextResponse.json(
      { error: 'El contenido del archivo no corresponde a un tipo permitido' },
      { status: 400 }
    )
  }
  const ext = EXT_BY_MIME[detectedMime]
  const mimeType = detectedMime

  const uploadDir = getUploadDir('equipment', equipmentId)
  if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true })

  const filename = `${randomUUID()}.${ext}`
  const filepath = getUploadDir('equipment', equipmentId, filename)
  await writeFile(filepath, buffer)

  const attachment = await prisma.equipment_attachments.create({
    data: {
      id: randomUUID(),
      equipmentId,
      filename,
      originalName: sanitizeOriginalFilename(file.name),
      mimeType,
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
