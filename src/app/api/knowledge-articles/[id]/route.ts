import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/knowledge-articles/[id]
 * 
 * Obtiene un artículo de conocimiento por su ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const article = await prisma.knowledge_articles.findUnique({
      where: {
        id,
        isPublished: true,
      },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        article: {
          id: article.id,
          title: article.title,
          content: article.content,
          summary: article.summary,
          categoryId: article.categoryId,
          tags: article.tags,
          views: article.views,
          helpfulVotes: article.helpfulVotes,
          notHelpfulVotes: article.notHelpfulVotes,
          isPublished: article.isPublished,
          createdAt: article.createdAt,
          updatedAt: article.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener el artículo',
      },
      { status: 500 }
    );
  }
}
