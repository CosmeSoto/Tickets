import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import {
  assertCanViewProcesses,
  getProcessAccess,
  isFamilyWithinProcessScope,
} from '@/lib/processes/access'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

type Params = { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id, attachmentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

    const denied = await assertCanViewProcesses(session.user.id, session.user.role)
    if (denied) return new NextResponse('Forbidden', { status: denied.status })

    const access = await getProcessAccess(session.user.id, session.user.role)
    const process = await (prisma as any).processes.findUnique({
      where: { id },
      select: { id: true, familyId: true, status: true },
    })
    if (!process || !isFamilyWithinProcessScope(access, process.familyId)) {
      return new NextResponse('Not found', { status: 404 })
    }
    if (!access.canManage && process.status !== 'PUBLISHED') {
      return new NextResponse('Not found', { status: 404 })
    }

    const attachment = await (prisma as any).process_attachments.findUnique({
      where: { id: attachmentId },
    })
    if (!attachment || attachment.processId !== id) {
      return new NextResponse('Not found', { status: 404 })
    }
    if (!existsSync(attachment.path)) {
      return new NextResponse('File not found on disk', { status: 404 })
    }

    const buffer = await readFile(attachment.path)
    const download = new URL(request.url).searchParams.get('download') === 'true'
    await AuditServiceComplete.log({
      action: AuditActionsComplete.FILE_DOWNLOADED,
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

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': download
          ? `attachment; filename="${encodeURIComponent(attachment.originalName)}"`
          : `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[processes attachment file]', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
