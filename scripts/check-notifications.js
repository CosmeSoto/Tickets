#!/usr/bin/env node

/**
 * Script para verificar notificaciones en la base de datos
 * Uso: node scripts/check-notifications.js [userId]
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkNotifications(userId) {
  try {
    console.log('🔍 Verificando notificaciones...\n')

    // Si se proporciona userId, filtrar por ese usuario
    const where = userId ? { userId } : {}

    // Obtener todas las notificaciones
    const notifications = await prisma.notifications.findMany({
      where,
      include: {
        users: {
          select: {
            name: true,
            email: true,
            role: true
          }
        },
        tickets: {
          select: {
            title: true,
            status: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    if (notifications.length === 0) {
      console.log('❌ No se encontraron notificaciones')
      if (userId) {
        console.log(`   Para el usuario: ${userId}`)
      }
      return
    }

    console.log(`✅ Se encontraron ${notifications.length} notificaciones\n`)
    console.log('═'.repeat(80))

    notifications.forEach((notif, index) => {
      console.log(`\n📬 Notificación ${index + 1}:`)
      console.log(`   ID: ${notif.id}`)
      console.log(`   Usuario: ${notif.users.name} (${notif.users.role})`)
      console.log(`   Email: ${notif.users.email}`)
      console.log(`   Tipo: ${notif.type}`)
      console.log(`   Título: ${notif.title}`)
      console.log(`   Mensaje: ${notif.message}`)
      console.log(`   Leída: ${notif.isRead ? '✅ Sí' : '❌ No'}`)
      console.log(`   Ticket: ${notif.tickets ? notif.tickets.title : 'N/A'}`)
      console.log(`   Link: ${notif.metadata?.link || notif.actionUrl || 'N/A'}`)
      console.log(`   Metadata: ${notif.metadata ? JSON.stringify(notif.metadata) : 'N/A'}`)
      console.log(`   Creada: ${notif.createdAt.toLocaleString()}`)
      console.log('─'.repeat(80))
    })

    // Estadísticas
    console.log('\n📊 Estadísticas:')
    const byUser = notifications.reduce((acc, n) => {
      const key = `${n.users.name} (${n.users.role})`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    console.log('\n   Por usuario:')
    Object.entries(byUser).forEach(([user, count]) => {
      console.log(`   - ${user}: ${count} notificaciones`)
    })

    const unread = notifications.filter(n => !n.isRead).length
    console.log(`\n   No leídas: ${unread}`)
    console.log(`   Leídas: ${notifications.length - unread}`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

// Obtener userId de argumentos de línea de comandos
const userId = process.argv[2]

if (userId) {
  console.log(`Filtrando por usuario: ${userId}\n`)
}

checkNotifications(userId)
