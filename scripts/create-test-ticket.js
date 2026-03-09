/**
 * Script para crear un ticket de prueba y verificar que se crean las notificaciones
 * 
 * Ejecutar con: node scripts/create-test-ticket.js
 */

const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')
const prisma = new PrismaClient()

async function main() {
  console.log('🎫 CREANDO TICKET DE PRUEBA\n')
  console.log('='.repeat(60))

  // 1. Obtener un cliente
  console.log('\n1️⃣ Buscando cliente...')
  const client = await prisma.users.findFirst({
    where: {
      role: 'CLIENT',
      isActive: true,
    },
  })

  if (!client) {
    console.log('   ❌ No se encontró ningún cliente activo')
    return
  }

  console.log(`   ✅ Cliente encontrado: ${client.name} (${client.email})`)

  // 2. Obtener una categoría
  console.log('\n2️⃣ Buscando categoría...')
  const category = await prisma.categories.findFirst({
    where: {
      isActive: true,
    },
  })

  if (!category) {
    console.log('   ❌ No se encontró ninguna categoría activa')
    return
  }

  console.log(`   ✅ Categoría encontrada: ${category.name}`)

  // 3. Crear el ticket
  console.log('\n3️⃣ Creando ticket...')
  const ticketId = randomUUID()
  
  const ticket = await prisma.tickets.create({
    data: {
      id: ticketId,
      title: `🧪 Ticket de prueba - ${new Date().toLocaleString()}`,
      description: 'Este es un ticket de prueba creado por el script de diagnóstico para verificar que las notificaciones se crean correctamente.',
      priority: 'MEDIUM',
      clientId: client.id,
      categoryId: category.id,
      status: 'OPEN',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: {
      users_tickets_clientIdTousers: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      categories: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  console.log(`   ✅ Ticket creado exitosamente:`)
  console.log(`      ID: ${ticket.id}`)
  console.log(`      Título: ${ticket.title}`)
  console.log(`      Cliente: ${ticket.users_tickets_clientIdTousers.name}`)
  console.log(`      Categoría: ${ticket.categories.name}`)

  // 4. Simular la creación de notificaciones (como lo hace el servicio)
  console.log('\n4️⃣ Creando notificaciones para administradores...')
  
  const admins = await prisma.users.findMany({
    where: {
      role: 'ADMIN',
      isActive: true,
    },
    select: { id: true, name: true, email: true },
  })

  console.log(`   ℹ️  Administradores encontrados: ${admins.length}`)

  if (admins.length === 0) {
    console.log('   ⚠️  NO HAY ADMINISTRADORES ACTIVOS - No se crearán notificaciones')
  } else {
    for (const admin of admins) {
      try {
        const notification = await prisma.notifications.create({
          data: {
            id: randomUUID(),
            userId: admin.id,
            type: 'INFO',
            title: 'Nuevo ticket creado',
            message: `${ticket.users_tickets_clientIdTousers.name} ha creado el ticket "${ticket.title}"`,
            ticketId: ticket.id,
            metadata: {
              priority: ticket.priority,
              category: ticket.categories.name,
            },
            isRead: false,
          },
        })

        console.log(`   ✅ Notificación creada para: ${admin.name}`)
        console.log(`      ID: ${notification.id}`)
      } catch (error) {
        console.error(`   ❌ Error al crear notificación para ${admin.name}:`, error.message)
      }
    }
  }

  // 5. Verificar que las notificaciones se crearon
  console.log('\n5️⃣ Verificando notificaciones creadas...')
  const notificationsForTicket = await prisma.notifications.findMany({
    where: {
      ticketId: ticket.id,
    },
    include: {
      users: {
        select: {
          name: true,
          role: true,
        },
      },
    },
  })

  console.log(`   ✅ Notificaciones encontradas: ${notificationsForTicket.length}`)
  notificationsForTicket.forEach((notif, index) => {
    console.log(`      ${index + 1}. Para: ${notif.users.name} (${notif.users.role})`)
    console.log(`         Título: ${notif.title}`)
    console.log(`         Leída: ${notif.isRead ? 'Sí' : 'No'}`)
  })

  console.log('\n' + '='.repeat(60))
  console.log('✅ Prueba completada\n')
  console.log(`📋 Ticket ID: ${ticket.id}`)
  console.log(`🔔 Notificaciones creadas: ${notificationsForTicket.length}`)
}

main()
  .catch((error) => {
    console.error('❌ Error en la prueba:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
