/**
 * API: Serve form attachment file
 * GET /api/admin/forms/[id]/attachments/[attachmentId]/file
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { assertCanViewForm } from '@/lib/forms/form-visibility'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'

type Params = { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id, attachmentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const denied = await assertCanViewForm(id, session.user.id)
    if (denied) {
      return new NextResponse(denied.status === 404 ? 'Not found' : 'Forbidden', {
        status: denied.status,
      })
    }

    const attachment = await prisma.form_attachments.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment || attachment.formId !== id) {
      return new NextResponse('Not found', { status: 404 })
    }

    if (!existsSync(attachment.path)) {
      return new NextResponse('File not found on disk', { status: 404 })
    }

    const buffer = await readFile(attachment.path)
    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

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
    console.error('Error sirviendo archivo de form:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
