import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { canManageInventory } from '@/lib/inventory-access'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { FileService } from '@/lib/services/file-service'

/**
 * GET /api/inventory/licenses/[id]/attachments
 * Lista adjuntos de una licencia
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: licenseId } = await params

  const attachments = await prisma.license_attachments.findMany({
    where: { licenseId },
    include: { uploader: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(attachments)
}

/**
 * POST /api/inventory/licenses/[id]/attachments
 * Sube un adjunto a una licencia
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return NextResponse.json(
      { error: 'No tienes permiso para gestionar el inventario' },
      { status: 403 }
    )
  }

  const { id: licenseId } = await params

  const license = await prisma.software_licenses.findUnique({ where: { id: licenseId } })
  if (!license) return NextResponse.json({ error: 'Licencia no encontrada' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

  let attachment
  try {
    attachment = await FileService.uploadLicenseFile({
      file,
      licenseId,
      uploadedBy: session.user.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al subir el archivo' },
      { status: 400 }
    )
  }

  await prisma.audit_logs.create({
    data: {
      id: randomUUID(),
      action: 'LICENSE_ATTACHMENT_UPLOAD',
      entityType: 'software_license',
      entityId: licenseId,
      userId: session.user.id,
      details: { filename: file.name, licenseName: license.name },
      createdAt: new Date(),
    },
  })

  return NextResponse.json(attachment, { status: 201 })
}
