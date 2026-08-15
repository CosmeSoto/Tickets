import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { FileService } from '@/lib/services/file-service'
import {
  assertCanManageProcesses,
  getProcessAccess,
  isFamilyWithinProcessScope,
} from '@/lib/processes/access'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

type Params = { params: Promise<{ id: string; attachmentId: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id, attachmentId } = await params
  const access = await getProcessAccess(session.user.id, session.user.role)
  const process = await (prisma as any).processes.findUnique({
    where: { id },
    select: { id: true, familyId: true },
  })
  if (!process || !isFamilyWithinProcessScope(access, process.familyId)) {
    return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })
  }

  const attachment = await (prisma as any).process_attachments.findUnique({
    where: { id: attachmentId },
  })
  if (!attachment || attachment.processId !== id) {
    return NextResponse.json({ error: 'Adjunto no encontrado.' }, { status: 404 })
  }

  await FileService.deleteProcessFile(attachmentId)
  await AuditServiceComplete.log({
    action: AuditActionsComplete.FILE_DELETED,
    entityType: 'process',
    entityId: id,
    userId: session.user.id,
    details: {
      source: 'processes_module',
      attachmentId,
      originalName: attachment.originalName,
    },
    request,
  })
  return NextResponse.json({ success: true })
}
