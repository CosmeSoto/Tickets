import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/knowledge-articles/[id]/view
 * 
 * Incrementa el contador de vistas de un artículo
 */
export async function POST(
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

    await prisma.knowledge_articles.update({
      where: { id },
      data: {
        views: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error incrementing article views:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al registrar vista',
      },
      { status: 500 }
    );
  }
}
