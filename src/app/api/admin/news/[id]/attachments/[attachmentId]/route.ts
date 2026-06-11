import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { FileService } from '@/lib/services/file-service'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Permitir admin o usuarios con canManageNews (gestores de noticias)
    if (session.user.role !== 'ADMIN') {
      const { prisma } = await import('@/lib/prisma')
      const user = await prisma.users.findUnique({
        where: { id: session.user.id },
        select: { canManageNews: true },
      })
      if (!user?.canManageNews) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
    }

    const { attachmentId } = await params

    await FileService.deleteNewsFile(attachmentId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[news-attachments] Error al eliminar archivo:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
