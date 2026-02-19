import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function verifyDatabase() {
  console.log('🔍 Verificando Base de Datos de Conocimientos\n')
  console.log('='.repeat(50))

  try {
    // 1. Verificar artículos
    console.log('\n📚 1. Artículos de Conocimiento')
    console.log('-'.repeat(50))
    
    const totalArticles = await prisma.knowledge_articles.count()
    const publishedArticles = await prisma.knowledge_articles.count({
      where: { isPublished: true }
    })
    
    console.log(`✓ Total de artículos: ${totalArticles}`)
    console.log(`✓ Artículos publicados: ${publishedArticles}`)
    
    // Artículos más vistos
    const topViewed = await prisma.knowledge_articles.findMany({
      take: 5,
      orderBy: { views: 'desc' },
      select: {
        title: true,
        views: true,
        helpfulVotes: true,
        notHelpfulVotes: true,
      }
    })
    
    console.log('\n📊 Top 5 artículos más vistos:')
    topViewed.forEach((article, index) => {
      const total = article.helpfulVotes + article.notHelpfulVotes
      const percentage = total > 0 ? Math.round((article.helpfulVotes / total) * 100) : 0
      console.log(`  ${index + 1}. ${article.title}`)
      console.log(`     Vistas: ${article.views} | ${percentage}% útil`)
    })

    // 2. Verificar votos
    console.log('\n\n👍 2. Sistema de Votación')
    console.log('-'.repeat(50))
    
    const totalVotes = await prisma.article_votes.count()
    const helpfulVotes = await prisma.article_votes.count({
      where: { isHelpful: true }
    })
    const notHelpfulVotes = await prisma.article_votes.count({
      where: { isHelpful: false }
    })
    
    console.log(`✓ Total de votos: ${totalVotes}`)
    console.log(`✓ Votos útiles: ${helpfulVotes}`)
    console.log(`✓ Votos no útiles: ${notHelpfulVotes}`)

    // 3. Verificar relaciones con tickets
    console.log('\n\n🎫 3. Relación con Tickets')
    console.log('-'.repeat(50))
    
    const articlesFromTickets = await prisma.knowledge_articles.count({
      where: { sourceTicketId: { not: null } }
    })
    
    console.log(`✓ Artículos creados desde tickets: ${articlesFromTickets}`)
    
    if (articlesFromTickets > 0) {
      const articlesWithTickets = await prisma.knowledge_articles.findMany({
        where: { sourceTicketId: { not: null } },
        take: 3,
        select: {
          title: true,
          sourceTicket: {
            select: {
              title: true,
              status: true,
            }
          }
        }
      })
      
      console.log('\n📋 Ejemplos de artículos desde tickets:')
      articlesWithTickets.forEach((article, index) => {
        console.log(`  ${index + 1}. ${article.title}`)
        console.log(`     Ticket: ${article.sourceTicket?.title} (${article.sourceTicket?.status})`)
      })
    }

    // 4. Verificar categorías
    console.log('\n\n📂 4. Distribución por Categorías')
    console.log('-'.repeat(50))
    
    const articlesByCategory = await prisma.knowledge_articles.groupBy({
      by: ['categoryId'],
      _count: true,
    })
    
    for (const group of articlesByCategory) {
      const category = await prisma.categories.findUnique({
        where: { id: group.categoryId },
        select: { name: true }
      })
      console.log(`✓ ${category?.name || 'Sin categoría'}: ${group._count} artículos`)
    }

    // 5. Verificar tags
    console.log('\n\n🏷️  5. Tags Más Usados')
    console.log('-'.repeat(50))
    
    const articles = await prisma.knowledge_articles.findMany({
      select: { tags: true }
    })
    
    const tagCount: Record<string, number> = {}
    articles.forEach(article => {
      article.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      })
    })
    
    const sortedTags = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
    
    sortedTags.forEach(([tag, count], index) => {
      console.log(`  ${index + 1}. ${tag}: ${count} artículos`)
    })

    // 6. Verificar autores
    console.log('\n\n👥 6. Autores de Artículos')
    console.log('-'.repeat(50))
    
    const articlesByAuthor = await prisma.knowledge_articles.groupBy({
      by: ['authorId'],
      _count: true,
    })
    
    for (const group of articlesByAuthor) {
      const author = await prisma.users.findUnique({
        where: { id: group.authorId },
        select: { name: true, role: true }
      })
      console.log(`✓ ${author?.name} (${author?.role}): ${group._count} artículos`)
    }

    // 7. Verificar calificaciones de tickets
    console.log('\n\n⭐ 7. Calificaciones de Tickets')
    console.log('-'.repeat(50))
    
    const totalRatings = await prisma.ticket_ratings.count()
    
    if (totalRatings > 0) {
      const avgRating = await prisma.ticket_ratings.aggregate({
        _avg: {
          overall: true,
          responseTime: true,
          technicalSkill: true,
          communication: true,
          problemResolution: true,
        }
      })
      
      console.log(`✓ Total de calificaciones: ${totalRatings}`)
      console.log(`✓ Promedio general: ${avgRating._avg.overall?.toFixed(2) || 0}/5`)
      console.log(`✓ Tiempo de respuesta: ${avgRating._avg.responseTime?.toFixed(2) || 0}/5`)
      console.log(`✓ Habilidad técnica: ${avgRating._avg.technicalSkill?.toFixed(2) || 0}/5`)
      console.log(`✓ Comunicación: ${avgRating._avg.communication?.toFixed(2) || 0}/5`)
      console.log(`✓ Resolución: ${avgRating._avg.problemResolution?.toFixed(2) || 0}/5`)
    } else {
      console.log('⚠️  No hay calificaciones registradas aún')
    }

    // 8. Verificar índices y performance
    console.log('\n\n⚡ 8. Verificación de Performance')
    console.log('-'.repeat(50))
    
    const startTime = Date.now()
    await prisma.knowledge_articles.findMany({
      where: {
        OR: [
          { title: { contains: 'vpn', mode: 'insensitive' } },
          { content: { contains: 'vpn', mode: 'insensitive' } },
        ]
      },
      take: 10,
    })
    const searchTime = Date.now() - startTime
    
    console.log(`✓ Búsqueda de texto: ${searchTime}ms ${searchTime < 500 ? '✓' : '⚠️'}`)
    
    const startTime2 = Date.now()
    await prisma.knowledge_articles.findMany({
      where: { categoryId: articlesByCategory[0]?.categoryId },
      take: 20,
    })
    const filterTime = Date.now() - startTime2
    
    console.log(`✓ Filtro por categoría: ${filterTime}ms ${filterTime < 300 ? '✓' : '⚠️'}`)

    // Resumen final
    console.log('\n\n' + '='.repeat(50))
    console.log('✅ VERIFICACIÓN COMPLETADA')
    console.log('='.repeat(50))
    
    const issues: string[] = []
    
    if (totalArticles === 0) issues.push('No hay artículos en la base de datos')
    if (searchTime > 500) issues.push('Búsqueda lenta (>500ms)')
    if (filterTime > 300) issues.push('Filtros lentos (>300ms)')
    
    if (issues.length > 0) {
      console.log('\n⚠️  Problemas encontrados:')
      issues.forEach(issue => console.log(`  - ${issue}`))
    } else {
      console.log('\n🎉 Todo funciona correctamente!')
    }
    
    console.log('\n📊 Resumen:')
    console.log(`  - ${totalArticles} artículos`)
    console.log(`  - ${totalVotes} votos`)
    console.log(`  - ${articlesFromTickets} artículos desde tickets`)
    console.log(`  - ${totalRatings} calificaciones`)
    console.log(`  - ${Object.keys(tagCount).length} tags únicos`)
    
  } catch (error) {
    console.error('\n❌ Error durante la verificación:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyDatabase()
