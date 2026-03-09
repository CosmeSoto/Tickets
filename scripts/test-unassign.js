#!/usr/bin/env node

/**
 * Script para probar desasignación de tickets
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testUnassign() {
  try {
    console.log('🧪 Iniciando prueba de desasignación...\n')

    // 1. Buscar un ticket asignado
    const ticket = await prisma.tickets.findFirst({
      where: {
        assigneeId: { not: null },
        status: { in: ['OPEN', 'IN_PROGRESS'] }
      },
      include: {
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        },
        users_tickets_clientIdTousers: {
          select: { name: true }
        }
      }
    })

    if (!ticket) {
      console.error('❌ No hay tickets asignados para probar')
      return
    }

    console.log('📋 Ticket encontrado:')
    console.log(`   ID: ${ticket.id}`)
    console.log(`   Título: ${ticket.title}`)
    console.log(`   Cliente: ${ticket.users_tickets_clientIdTousers.name}`)
    console.log(`   Técnico actual: ${ticket.users_tickets_assigneeIdTousers.name}`)
    console.log(`   Estado: ${ticket.status}`)

    console.log(`\n🔄 Desasignando ticket (estableciendo assigneeId a null)...`)

    // 2. Desasignar el ticket
    const updatedTicket = await prisma.tickets.update({
      where: { id: ticket.id },
      data: {
        assigneeId: null,
        status: 'OPEN',
        updatedAt: new Date()
      },
      include: {
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    console.log('✅ Ticket desasignado exitosamente')

    // 3. Verificar el cambio
    const verifyTicket = await prisma.tickets.findUnique({
      where: { id: ticket.id },
      select: {
        assigneeId: true,
        status: true,
        users_tickets_assigneeIdTousers: {
          select: { name: true }
        }
      }
    })

    console.log('\n🔍 Verificación:')
    console.log(`   Técnico asignado: ${verifyTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'}`)
    console.log(`   Estado: ${verifyTicket.status}`)
    console.log(`   assigneeId: ${verifyTicket.assigneeId || 'null'}`)

    if (verifyTicket.assigneeId === null) {
      console.log('\n✅ ¡Prueba exitosa! El ticket fue desasignado correctamente')
    } else {
      console.log('\n❌ Error: El ticket no fue desasignado correctamente')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

testUnassign()
