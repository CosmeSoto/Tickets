#!/usr/bin/env node

/**
 * Script para probar asignación automática y verificar notificaciones
 */

const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')
const prisma = new PrismaClient()

async function testAutoAssign() {
  try {
    console.log('🧪 Iniciando prueba de asignación automática...\n')

    // 1. Buscar un ticket sin asignar
    let ticket = await prisma.tickets.findFirst({
      where: {
        assigneeId: null,
        status: 'OPEN'
      },
      include: {
        users_tickets_clientIdTousers: {
          select: { name: true, email: true }
        },
        categories: {
          select: { name: true }
        }
      }
    })

    // Si no hay tickets sin asignar, crear uno
    if (!ticket) {
      console.log('📝 No hay tickets sin asignar, creando uno de prueba...')
      
      const client = await prisma.users.findFirst({
        where: { role: 'CLIENT' }
      })

      const category = await prisma.categories.findFirst({
        where: { isActive: true }
      })

      if (!client || !category) {
        console.error('❌ No hay clientes o categorías disponibles')
        return
      }

      ticket = await prisma.tickets.create({
        data: {
          id: randomUUID(),
          title: 'Ticket de prueba - Asignación automática',
          description: 'Este es un ticket de prueba para verificar la asignación automática y notificaciones',
          priority: 'MEDIUM',
          status: 'OPEN',
          clientId: client.id,
          categoryId: category.id,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          users_tickets_clientIdTousers: {
            select: { name: true, email: true }
          },
          categories: {
            select: { name: true }
          }
        }
      })

      console.log(`✅ Ticket creado: ${ticket.id}`)
    }

    console.log(`\n📋 Ticket a asignar:`)
    console.log(`   ID: ${ticket.id}`)
    console.log(`   Título: ${ticket.title}`)
    console.log(`   Cliente: ${ticket.users_tickets_clientIdTousers.name}`)
    console.log(`   Categoría: ${ticket.categories.name}`)
    console.log(`   Estado: ${ticket.status}`)

    // 2. Buscar técnicos disponibles
    const technicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    if (technicians.length === 0) {
      console.error('\n❌ No hay técnicos disponibles')
      return
    }

    console.log(`\n👥 Técnicos disponibles: ${technicians.length}`)
    technicians.forEach((tech, i) => {
      console.log(`   ${i + 1}. ${tech.name} (${tech.email})`)
    })

    // 3. Asignar al primer técnico
    const selectedTech = technicians[0]
    console.log(`\n🎯 Asignando a: ${selectedTech.name}`)

    const updatedTicket = await prisma.tickets.update({
      where: { id: ticket.id },
      data: {
        assigneeId: selectedTech.id,
        status: 'IN_PROGRESS',
        updatedAt: new Date()
      }
    })

    console.log(`✅ Ticket asignado exitosamente`)

    // 4. Crear notificaciones manualmente
    console.log(`\n📬 Creando notificaciones...`)

    // Notificación para el técnico
    const techNotif = await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: selectedTech.id,
        ticketId: ticket.id,
        type: 'INFO',
        title: 'Ticket asignado',
        message: `Se te ha asignado el ticket: ${ticket.title}`,
        metadata: {
          link: `/technician/tickets/${ticket.id}`,
          priority: ticket.priority
        },
        isRead: false,
        createdAt: new Date()
      }
    })

    console.log(`   ✅ Notificación para técnico creada: ${techNotif.id}`)

    // Notificación para el cliente
    const clientNotif = await prisma.notifications.create({
      data: {
        id: randomUUID(),
        userId: ticket.clientId,
        ticketId: ticket.id,
        type: 'INFO',
        title: 'Ticket asignado',
        message: `Tu ticket ha sido asignado a ${selectedTech.name}`,
        metadata: {
          link: `/client/tickets/${ticket.id}`
        },
        isRead: false,
        createdAt: new Date()
      }
    })

    console.log(`   ✅ Notificación para cliente creada: ${clientNotif.id}`)

    // 5. Verificar notificaciones
    console.log(`\n🔍 Verificando notificaciones creadas...`)

    const techNotifications = await prisma.notifications.findMany({
      where: { userId: selectedTech.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    console.log(`\n   Notificaciones del técnico (${selectedTech.name}):`)
    techNotifications.forEach((n, i) => {
      console.log(`   ${i + 1}. ${n.title} - ${n.isRead ? 'Leída' : 'No leída'}`)
    })

    console.log(`\n✅ Prueba completada exitosamente!`)
    console.log(`\n📝 Ahora puedes:`)
    console.log(`   1. Iniciar sesión como: ${selectedTech.email}`)
    console.log(`   2. Verificar que aparezca la notificación en la campanita`)
    console.log(`   3. Click en la notificación para ir al ticket`)

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

testAutoAssign()
