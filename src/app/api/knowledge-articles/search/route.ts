import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/knowledge-articles/search
 * 
 * Busca artículos en la base de conocimientos por texto.
 * Busca en título, contenido, resumen y tags.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (query.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'La búsqueda debe tener al menos 2 caracteres' },
        { status: 400 }
      );
    }

    // Normalizar query para búsqueda
    const normalizeText = (text: string) =>
      text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const normalizedQuery = normalizeText(query);
    const keywords = normalizedQuery
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .map((word) => word.replace(/[^\w]/g, ''));

    // Buscar artículos publicados
    const articles = await prisma.knowledge_articles.findMany({
      where: {
        isPublished: true,
        OR: [
          {
            title: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            content: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            summary: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: [
        { helpfulVotes: 'desc' },
        { views: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit * 2, // Obtener más para poder filtrar por relevancia
    });

    // Calcular relevancia para cada artículo
    const articlesWithRelevance = articles.map((article) => {
      let relevanceScore = 0;

      const normalizedTitle = normalizeText(article.title);
      const normalizedContent = normalizeText(article.content);
      const normalizedSummary = article.summary ? normalizeText(article.summary) : '';
      const normalizedTags = article.tags.map((tag) => normalizeText(tag));

      // Calcular coincidencias
      let matches = 0;
      for (const keyword of keywords) {
        // Título vale más
        if (normalizedTitle.includes(keyword)) matches += 5;
        // Resumen vale bastante
        if (normalizedSummary.includes(keyword)) matches += 3;
        // Tags valen bastante
        if (normalizedTags.some((tag) => tag.includes(keyword))) matches += 3;
        // Contenido vale menos
        if (normalizedContent.includes(keyword)) matches += 1;
      }

      // Calcular score base
      relevanceScore = Math.min(1, matches * 0.1);

      // Bonus por coincidencia exacta en título
      if (normalizedTitle.includes(normalizedQuery)) {
        relevanceScore = Math.min(1, relevanceScore + 0.3);
      }

      // Bonus por votos útiles
      const totalVotes = article.helpfulVotes + article.notHelpfulVotes;
      if (totalVotes > 0) {
        const helpfulRatio = article.helpfulVotes / totalVotes;
        relevanceScore = relevanceScore * 0.8 + helpfulRatio * 0.2;
      }

      return {
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
        relevanceScore,
      };
    });

    // Ordenar por relevancia y limitar resultados
    const sortedResults = articlesWithRelevance
      .filter((item) => item.relevanceScore > 0.1) // Filtrar resultados poco relevantes
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        results: sortedResults,
        total: sortedResults.length,
        query,
      },
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al buscar artículos',
      },
      { status: 500 }
    );
  }
}
