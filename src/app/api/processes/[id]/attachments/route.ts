import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { FileService } from '@/lib/services/file-service'
import {
  assertCanManageProcesses,
  assertCanViewProcesses,
  getProcessAccess,
  isFamilyWithinProcessScope,
  sanitizeProcessAttachment,
} from '@/lib/processes/access'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

type Params = { params: Promise<{ id: string }> }

async function loadScopedProcess(id: string, userId: string, role: string) {
  const [access, process] = await Promise.all([
    getProcessAccess(userId, role),
    (prisma as any).processes.findUnique({
      where: { id },
      select: { id: true, familyId: true, status: true },
    }),
  ])
  if (!process || !isFamilyWithinProcessScope(access, process.familyId)) return null
  return process
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanViewProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id } = await params
  const process = await loadScopedProcess(id, session.user.id, session.user.role)
  if (!process) return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })
  if (process.status !== 'PUBLISHED') {
    const access = await getProcessAccess(session.user.id, session.user.role)
    if (!access.canManage)
      return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })
  }
  const attachments = await FileService.getFilesByProcess(id)
  return NextResponse.json({
    attachments: attachments.map((attachment: any) => sanitizeProcessAttachment(attachment)),
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id } = await params
  const process = await loadScopedProcess(id, session.user.id, session.user.role)
  if (!process) return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ningún archivo.' }, { status: 400 })
  }

  try {
    const attachment = await FileService.uploadProcessFile({
      file,
      processId: id,
      uploadedById: session.user.id,
    })
    await AuditServiceComplete.log({
      action: AuditActionsComplete.FILE_UPLOADED,
      entityType: 'process',
      entityId: id,
      userId: session.user.id,
      details: {
        source: 'processes_module',
        attachmentId: attachment.id,
        originalName: attachment.originalName,
        size: attachment.size,
      },
      request,
    })
    return NextResponse.json({ attachment: sanitizeProcessAttachment(attachment) }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al subir el archivo.' },
      { status: 500 }
    )
  }
}
