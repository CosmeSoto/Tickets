import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/knowledge-articles/related
 * 
 * Busca artículos relacionados con una categoría y opcionalmente con el contenido del ticket.
 * Ordena por relevancia: coincidencia con problema + votos útiles + fecha de actualización.
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
    const categoryId = searchParams.get('categoryId');
    const title = searchParams.get('title') || '';
    const description = searchParams.get('description') || '';
    const limit = parseInt(searchParams.get('limit') || '3', 10);

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId es requerido' },
        { status: 400 }
      );
    }

    // Buscar artículos publicados de la categoría
    const articles = await prisma.knowledge_articles.findMany({
      where: {
        categoryId,
        isPublished: true,
      },
      orderBy: [
        { helpfulVotes: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit * 2, // Obtener más para poder filtrar por relevancia
    });

    // Calcular relevancia basándose en coincidencia de texto
    const articlesWithRelevance = articles.map((article) => {
      let relevanceScore = 0.5; // Score base

      // Normalizar textos para comparación
      const normalizeText = (text: string) =>
        text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      const normalizedTitle = normalizeText(title);
      const normalizedDescription = normalizeText(description);
      const normalizedArticleTitle = normalizeText(article.title);
      const normalizedArticleContent = normalizeText(article.content);
      const normalizedArticleSummary = article.summary
        ? normalizeText(article.summary)
        : '';

      // Extraer palabras clave (palabras de más de 3 caracteres)
      const extractKeywords = (text: string) =>
        text
          .split(/\s+/)
          .filter((word) => word.length > 3)
          .map((word) => word.replace(/[^\w]/g, ''));

      const titleKeywords = extractKeywords(normalizedTitle);
      const descriptionKeywords = extractKeywords(normalizedDescription);
      const allKeywords = [...new Set([...titleKeywords, ...descriptionKeywords])];

      // Calcular coincidencias
      let matches = 0;
      for (const keyword of allKeywords) {
        if (normalizedArticleTitle.includes(keyword)) matches += 3; // Título vale más
        if (normalizedArticleSummary.includes(keyword)) matches += 2;
        if (normalizedArticleContent.includes(keyword)) matches += 1;
      }

      // Ajustar score basándose en coincidencias
      if (matches > 0) {
        relevanceScore = Math.min(1, 0.5 + matches * 0.1);
      }

      // Bonus por votos útiles
      const totalVotes = article.helpfulVotes + article.notHelpfulVotes;
      if (totalVotes > 0) {
        const helpfulRatio = article.helpfulVotes / totalVotes;
        relevanceScore = relevanceScore * 0.7 + helpfulRatio * 0.3;
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
    const sortedArticles = articlesWithRelevance
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        articles: sortedArticles,
        total: sortedArticles.length,
      },
    });
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al buscar artículos relacionados',
      },
      { status: 500 }
    );
  }
}
