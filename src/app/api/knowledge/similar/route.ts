import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Schema de validación para búsqueda de similares
const similarSearchSchema = z.object({
  title: z.string().min(1, 'El título es requerido').max(500),
  description: z.string().optional().default(''),
  categoryId: z.string().optional(),
  limit: z.number().min(1).max(20).optional().default(5),
})

// Función para extraer palabras clave
function extractKeywords(text: string): string[] {
  // Palabras comunes a ignorar (stop words en español)
  const stopWords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
    'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
    'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
    'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin',
    'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo',
    'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero',
    'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella',
  ])

  return text
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, ' ') // Remover puntuación
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10) // Tomar las primeras 10 palabras significativas
}

// Función para calcular score de relevancia
function calculateRelevanceScore(
  article: any,
  keywords: string[],
  categoryId?: string
): number {
  let score = 0

  // Coincidencias en título (peso: 3)
  const titleLower = article.title.toLowerCase()
  keywords.forEach(keyword => {
    if (titleLower.includes(keyword)) {
      score += 3
    }
  })

  // Coincidencias en tags (peso: 2)
  const articleTags = article.tags.map((tag: string) => tag.toLowerCase())
  keywords.forEach(keyword => {
    if (articleTags.some((tag: string) => tag.includes(keyword))) {
      score += 2
    }
  })

  // Coincidencias en contenido (peso: 1)
  const contentLower = article.content.toLowerCase()
  keywords.forEach(keyword => {
    if (contentLower.includes(keyword)) {
      score += 1
    }
  })

  // Bonus por misma categoría (peso: 5)
  if (categoryId && article.categoryId === categoryId) {
    score += 5
  }

  // Bonus por votos útiles (normalizado)
  const helpfulRatio = article.helpfulVotes / Math.max(article.helpfulVotes + article.notHelpfulVotes, 1)
  score += helpfulRatio * 2

  // Bonus por popularidad (vistas)
  score += Math.log10(article.views + 1) * 0.5

  return score
}

// POST /api/knowledge/similar - Buscar artículos similares
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    
    console.log('[API-Similar] Received body:', body)
    
    // Validar datos
    const validationResult = similarSearchSchema.safeParse(body)
    if (!validationResult.success) {
      console.error('[API-Similar] Validation failed:', validationResult.error.errors)
      return NextResponse.json(
        { 
          error: 'Datos inválidos', 
          details: validationResult.error.errors,
          received: body
        },
        { status: 400 }
      )
    }

    const { title, description, categoryId, limit } = validationResult.data

    // Extraer palabras clave del título y descripción
    const combinedText = `${title} ${description || ''}`
    const keywords = extractKeywords(combinedText)

    if (keywords.length === 0) {
      return NextResponse.json({
        articles: [],
        message: 'No se pudieron extraer palabras clave para la búsqueda',
      })
    }

    // Construir condiciones de búsqueda
    const whereConditions: any = {
      isPublished: true,
      OR: [
        // Buscar en título
        ...keywords.map(keyword => ({
          title: { contains: keyword, mode: 'insensitive' as const },
        })),
        // Buscar en contenido
        ...keywords.map(keyword => ({
          content: { contains: keyword, mode: 'insensitive' as const },
        })),
        // Buscar en tags
        {
          tags: { hasSome: keywords },
        },
      ],
    }

    // Si hay categoría, priorizar pero no limitar
    if (categoryId) {
      // Buscar primero en la misma categoría
      const sameCategoryArticles = await prisma.knowledge_articles.findMany({
        where: {
          ...whereConditions,
          categoryId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              votes: true,
            },
          },
        },
        take: limit * 2, // Obtener más para filtrar después
      })

      // Si no hay suficientes, buscar en otras categorías
      if (sameCategoryArticles.length < limit) {
        const otherArticles = await prisma.knowledge_articles.findMany({
          where: {
            ...whereConditions,
            categoryId: { not: categoryId },
          },
          include: {
            category: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            _count: {
              select: {
                votes: true,
              },
            },
          },
          take: limit,
        })

        const allArticles = [...sameCategoryArticles, ...otherArticles]
        
        // Calcular relevancia y ordenar
        const articlesWithScore = allArticles.map(article => ({
          ...article,
          relevanceScore: calculateRelevanceScore(article, keywords, categoryId),
          helpfulPercentage: article.helpfulVotes + article.notHelpfulVotes > 0
            ? Math.round((article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100)
            : 0,
        }))

        articlesWithScore.sort((a, b) => b.relevanceScore - a.relevanceScore)

        return NextResponse.json({
          articles: articlesWithScore.slice(0, limit),
          keywords,
          totalFound: articlesWithScore.length,
        })
      }

      // Calcular relevancia y ordenar
      const articlesWithScore = sameCategoryArticles.map(article => ({
        ...article,
        relevanceScore: calculateRelevanceScore(article, keywords, categoryId),
        helpfulPercentage: article.helpfulVotes + article.notHelpfulVotes > 0
          ? Math.round((article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100)
          : 0,
      }))

      articlesWithScore.sort((a, b) => b.relevanceScore - a.relevanceScore)

      return NextResponse.json({
        articles: articlesWithScore.slice(0, limit),
        keywords,
        totalFound: articlesWithScore.length,
      })
    }

    // Búsqueda sin categoría específica
    const articles = await prisma.knowledge_articles.findMany({
      where: whereConditions,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            votes: true,
          },
        },
      },
      take: limit * 2,
    })

    // Calcular relevancia y ordenar
    const articlesWithScore = articles.map(article => ({
      ...article,
      relevanceScore: calculateRelevanceScore(article, keywords),
      helpfulPercentage: article.helpfulVotes + article.notHelpfulVotes > 0
        ? Math.round((article.helpfulVotes / (article.helpfulVotes + article.notHelpfulVotes)) * 100)
        : 0,
    }))

    articlesWithScore.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return NextResponse.json({
      articles: articlesWithScore.slice(0, limit),
      keywords,
      totalFound: articlesWithScore.length,
    })
  } catch (error) {
    console.error('Error al buscar artículos similares:', error)
    return NextResponse.json(
      { error: 'Error al buscar artículos similares' },
      { status: 500 }
    )
  }
}
