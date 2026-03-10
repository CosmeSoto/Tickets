/**
 * Script para actualizar métricas en artículos existentes
 * 
 * Este script actualiza los artículos de conocimiento que fueron creados
 * con la versión antigua del código que solo mostraba métricas del plan.
 * 
 * Uso: npx tsx scripts/update-article-metrics.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Función para formatear duración
function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (1000 * 60))
  const hours = Math.round(minutes / 60 * 10) / 10
  const days = Math.floor(hours / 24)
  const remainingHours = Math.round((hours % 24) * 10) / 10
  
  if (days > 0) {
    return `${days} ${days === 1 ? 'día' : 'días'}${remainingHours > 0 ? ` ${remainingHours} horas` : ''}`
  }
  if (hours < 1) {
    return `${minutes} minutos`
  }
  return `${hours} horas`
}

async function updateArticleMetrics() {
  console.log('🔄 Iniciando actualización de métricas en artículos...\n')
  
  // Obtener todos los artículos que tienen un ticket de origen
  const articles = await prisma.knowledge_articles.findMany({
    where: {
      sourceTicketId: { not: null }
    },
    include: {
      sourceTicket: {
        include: {
          comments: {
            orderBy: { createdAt: 'asc' },
            include: {
              users: {
                select: {
                  role: true
                }
              }
            }
          },
          resolution_plans: {
            include: {
              tasks: true
            }
          }
        }
      }
    }
  })
  
  console.log(`📊 Encontrados ${articles.length} artículos con ticket de origen\n`)
  
  let updated = 0
  let skipped = 0
  
  for (const article of articles) {
    const ticket = article.sourceTicket
    
    if (!ticket) {
      console.log(`⚠️  Artículo "${article.title}" no tiene ticket asociado`)
      skipped++
      continue
    }
    
    // Verificar si el artículo tiene la sección antigua de métricas
    if (!article.content.includes('### Métricas')) {
      console.log(`✓ Artículo "${article.title}" ya tiene métricas actualizadas`)
      skipped++
      continue
    }
    
    console.log(`🔧 Actualizando artículo: "${article.title}"`)
    
    // Calcular métricas reales
    const createdAt = new Date(ticket.createdAt)
    const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : new Date()
    const resolutionTimeMs = resolvedAt.getTime() - createdAt.getTime()
    const resolutionTime = formatDuration(resolutionTimeMs)
    
    // Tiempo de primera respuesta
    const firstTechComment = ticket.comments.find(c => 
      c.users.role === 'TECHNICIAN' || c.users.role === 'ADMIN'
    )
    let firstResponseTime = 'N/A'
    if (firstTechComment) {
      const firstResponseMs = new Date(firstTechComment.createdAt).getTime() - createdAt.getTime()
      firstResponseTime = formatDuration(firstResponseMs)
    }
    
    // Interacciones
    const clientComments = ticket.comments.filter(c => c.users.role === 'CLIENT').length
    const techComments = ticket.comments.filter(c => 
      c.users.role === 'TECHNICIAN' || c.users.role === 'ADMIN'
    ).length
    
    // Construir nueva sección de métricas
    let newMetricsSection = `## 📊 Métricas de Resolución\n\n`
    newMetricsSection += `- **Tiempo de resolución:** ${resolutionTime}\n`
    newMetricsSection += `- **Tiempo de primera respuesta:** ${firstResponseTime}\n`
    newMetricsSection += `- **Interacciones totales:** ${ticket.comments.length} (${clientComments} del cliente, ${techComments} del equipo técnico)\n`
    
    // Agregar información del plan si existe
    if (ticket.resolution_plans && ticket.resolution_plans.length > 0) {
      const plan = ticket.resolution_plans[0]
      newMetricsSection += `- **Tareas del plan:** ${plan.completedTasks} de ${plan.totalTasks} completadas\n`
      if (plan.estimatedHours) {
        newMetricsSection += `- **Tiempo estimado del plan:** ${plan.estimatedHours} horas\n`
      }
      if (plan.actualHours && plan.actualHours > 0) {
        newMetricsSection += `- **Tiempo real del plan:** ${plan.actualHours} horas\n`
      }
    }
    newMetricsSection += `\n`
    
    // Reemplazar la sección antigua de métricas
    let updatedContent = article.content
    
    // Eliminar la sección antigua "### Métricas" dentro del plan
    const oldMetricsRegex = /### Métricas\s*\n\n[\s\S]*?(?=\n##|\n\n##|$)/
    updatedContent = updatedContent.replace(oldMetricsRegex, '')
    
    // Agregar la nueva sección de métricas después del plan (o después de la descripción si no hay plan)
    const planEndRegex = /## 📝 Plan de Resolución[\s\S]*?(?=\n## |$)/
    const problemEndRegex = /## 🔍 Problema Reportado[\s\S]*?(?=\n## |$)/
    
    if (updatedContent.match(planEndRegex)) {
      // Insertar después del plan
      updatedContent = updatedContent.replace(
        planEndRegex,
        (match) => match + '\n' + newMetricsSection
      )
    } else if (updatedContent.match(problemEndRegex)) {
      // Insertar después del problema si no hay plan
      updatedContent = updatedContent.replace(
        problemEndRegex,
        (match) => match + '\n' + newMetricsSection
      )
    } else {
      // Agregar al final si no se encuentra ninguna sección
      updatedContent += '\n' + newMetricsSection
    }
    
    // Actualizar el artículo
    await prisma.knowledge_articles.update({
      where: { id: article.id },
      data: { content: updatedContent }
    })
    
    console.log(`  ✓ Métricas actualizadas`)
    console.log(`    - Tiempo de resolución: ${resolutionTime}`)
    console.log(`    - Primera respuesta: ${firstResponseTime}`)
    console.log(`    - Interacciones: ${ticket.comments.length}\n`)
    
    updated++
  }
  
  console.log('\n📈 Resumen:')
  console.log(`  ✓ Artículos actualizados: ${updated}`)
  console.log(`  - Artículos omitidos: ${skipped}`)
  console.log(`  📊 Total procesados: ${articles.length}`)
  console.log('\n✅ Actualización completada!')
}

// Ejecutar el script
updateArticleMetrics()
  .catch((error) => {
    console.error('❌ Error al actualizar métricas:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
