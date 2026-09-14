/**
 * API: Serve form attachment file
 * GET /api/admin/forms/[id]/attachments/[attachmentId]/file
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { serveFormAttachment } from '@/lib/forms/serve-form-attachment'

type Params = { params: Promise<{ id: string; attachmentId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id, attachmentId } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'

    return await serveFormAttachment(id, attachmentId, session.user.id, download)
  } catch (error) {
    console.error('Error sirviendo archivo de form:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
