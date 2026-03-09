import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/knowledge-articles/[id]/vote
 * 
 * Registra un voto (útil/no útil) para un artículo
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { isHelpful } = body;

    if (typeof isHelpful !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isHelpful debe ser un booleano' },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Verificar si el usuario ya votó
    const existingVote = await prisma.article_votes.findFirst({
      where: {
        articleId: id,
        userId: session.user.id,
      },
    });

    if (existingVote) {
      // Si ya votó, actualizar el voto
      await prisma.$transaction([
        // Actualizar el voto
        prisma.article_votes.update({
          where: { id: existingVote.id },
          data: { isHelpful },
        }),
        // Ajustar contadores del artículo
        prisma.knowledge_articles.update({
          where: { id },
          data: {
            helpfulVotes: {
              increment: isHelpful && !existingVote.isHelpful ? 1 : !isHelpful && existingVote.isHelpful ? -1 : 0,
            },
            notHelpfulVotes: {
              increment: !isHelpful && existingVote.isHelpful ? 1 : isHelpful && !existingVote.isHelpful ? -1 : 0,
            },
          },
        }),
      ]);
    } else {
      // Crear nuevo voto
      await prisma.$transaction([
        prisma.article_votes.create({
          data: {
            articleId: id,
            userId: session.user.id,
            isHelpful,
          },
        }),
        prisma.knowledge_articles.update({
          where: { id },
          data: {
            helpfulVotes: {
              increment: isHelpful ? 1 : 0,
            },
            notHelpfulVotes: {
              increment: !isHelpful ? 1 : 0,
            },
          },
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error voting on article:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al registrar voto',
      },
      { status: 500 }
    );
  }
}
