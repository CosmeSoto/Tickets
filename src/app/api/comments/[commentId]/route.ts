import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { commentId } = await params
    const updateData = await request.json()

    if (!updateData.content?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'El contenido del comentario es requerido'
        },
        { status: 400 }
      )
    }

    // Verificar que el comentario existe
    const existingComment = await prisma.comments.findUnique({
      where: { id: commentId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        tickets: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    if (!existingComment) {
      return NextResponse.json(
        { success: false, message: 'Comentario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo el autor o admin pueden editar
    if (session.user.role !== 'ADMIN' && existingComment.authorId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para editar este comentario' },
        { status: 403 }
      )
    }

    // Actualizar comentario
    const updatedComment = await prisma.comments.update({
      where: { id: commentId },
      data: {
        content: updateData.content,
        updatedAt: new Date()
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    // ⭐ AUDITORÍA: Registrar actualización de comentario
    await AuditServiceComplete.log({
      action: AuditActionsComplete.COMMENT_UPDATED,
      entityType: 'comment',
      entityId: commentId,
      userId: session.user.id,
      details: {
        ticketId: existingComment.ticketId,
        ticketTitle: existingComment.tickets.title,
        authorName: existingComment.users.name,
        updatedBy: session.user.name,
        contentPreview: updateData.content.substring(0, 100)
      },
      oldValues: {
        content: existingComment.content
      },
      newValues: {
        content: updateData.content
      },
      request: request
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedComment.id,
        ticketId: updatedComment.ticketId,
        content: updatedComment.content,
        isInternal: updatedComment.isInternal,
        createdAt: updatedComment.createdAt.toISOString(),
        updatedAt: updatedComment.updatedAt.toISOString(),
        user: updatedComment.users
      },
      message: 'Comentario actualizado exitosamente'
    })
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar comentario',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { commentId } = await params

    // Verificar que el comentario existe
    const existingComment = await prisma.comments.findUnique({
      where: { id: commentId },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        tickets: {
          select: {
            id: true,
            title: true
          }
        }
      }
    })

    if (!existingComment) {
      return NextResponse.json(
        { success: false, message: 'Comentario no encontrado' },
        { status: 404 }
      )
    }

    // Verificar permisos: solo el autor o admin pueden eliminar
    if (session.user.role !== 'ADMIN' && existingComment.authorId !== session.user.id) {
      return NextResponse.json(
        { success: false, message: 'No tienes permisos para eliminar este comentario' },
        { status: 403 }
      )
    }

    // Eliminar comentario
    await prisma.comments.delete({
      where: { id: commentId }
    })

    // ⭐ AUDITORÍA: Registrar eliminación de comentario
    await AuditServiceComplete.log({
      action: AuditActionsComplete.COMMENT_DELETED,
      entityType: 'comment',
      entityId: commentId,
      userId: session.user.id,
      details: {
        ticketId: existingComment.ticketId,
        ticketTitle: existingComment.tickets.title,
        authorName: existingComment.users.name,
        deletedBy: session.user.name,
        contentPreview: existingComment.content.substring(0, 100),
        isInternal: existingComment.isInternal
      },
      request: request
    })

    return NextResponse.json({
      success: true,
      message: 'Comentario eliminado exitosamente'
    })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar comentario',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
