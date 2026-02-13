const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verificarArticulos() {
  console.log('🔍 Verificando artículos en base de datos...\n')
  
  try {
    // Contar artículos
    const totalArticulos = await prisma.knowledge_articles.count()
    console.log(`📊 Total de artículos: ${totalArticulos}`)
    
    // Obtener artículos
    const articulos = await prisma.knowledge_articles.findMany({
      include: {
        category: {
          select: {
            name: true,
            departments: {
              select: {
                name: true
              }
            }
          }
        },
        author: {
          select: {
            name: true,
            role: true
          }
        },
        sourceTicket: {
          select: {
            id: true,
            title: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    console.log('\n📝 Artículos encontrados:\n')
    
    if (articulos.length === 0) {
      console.log('❌ No hay artículos en la base de datos')
    } else {
      articulos.forEach((articulo, index) => {
        console.log(`${index + 1}. ${articulo.title}`)
        console.log(`   ID: ${articulo.id}`)
        console.log(`   Categoría: ${articulo.category?.name || 'N/A'}`)
        console.log(`   Departamento: ${articulo.category?.departments?.name || 'N/A'}`)
        console.log(`   Autor: ${articulo.author?.name} (${articulo.author?.role})`)
        console.log(`   Publicado: ${articulo.isPublished ? 'Sí' : 'No'}`)
        console.log(`   Vistas: ${articulo.views}`)
        console.log(`   Tags: ${articulo.tags.join(', ')}`)
        if (articulo.sourceTicket) {
          console.log(`   Ticket origen: ${articulo.sourceTicket.title} (${articulo.sourceTicket.status})`)
        }
        console.log(`   Creado: ${articulo.createdAt}`)
        console.log('')
      })
    }
    
    // Verificar categorías
    const categorias = await prisma.categories.count()
    console.log(`\n📁 Total de categorías: ${categorias}`)
    
    // Verificar usuarios
    const usuarios = await prisma.users.count()
    console.log(`👥 Total de usuarios: ${usuarios}`)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verificarArticulos()
