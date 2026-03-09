#!/usr/bin/env node

/**
 * Script para probar asignación manual de tickets
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function testManualAssign() {
  try {
    console.log('🧪 Iniciando prueba de asignación manual...\n')

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

    // 2. Buscar otro técnico para reasignar
    const technicians = await prisma.users.findMany({
      where: {
        role: 'TECHNICIAN',
        isActive: true,
        id: { not: ticket.assigneeId } // Excluir el técnico actual
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })

    if (technicians.length === 0) {
      console.error('\n❌ No hay otros técnicos disponibles para reasignar')
      return
    }

    const newTechnician = technicians[0]
    console.log(`\n🔄 Reasignando a: ${newTechnician.name}`)

    // 3. Actualizar asignación
    const updatedTicket = await prisma.tickets.update({
      where: { id: ticket.id },
      data: {
        assigneeId: newTechnician.id,
        status: 'IN_PROGRESS',
        updatedAt: new Date()
      },
      include: {
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    console.log('✅ Ticket reasignado exitosamente')
    console.log(`   Nuevo técnico: ${updatedTicket.users_tickets_assigneeIdTousers.name}`)

    // 4. Verificar el cambio
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
    console.log(`   Técnico asignado: ${verifyTicket.users_tickets_assigneeIdTousers.name}`)
    console.log(`   Estado: ${verifyTicket.status}`)
    console.log(`   assigneeId: ${verifyTicket.assigneeId}`)

    if (verifyTicket.assigneeId === newTechnician.id) {
      console.log('\n✅ ¡Prueba exitosa! La asignación se guardó correctamente')
    } else {
      console.log('\n❌ Error: La asignación no se guardó correctamente')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

testManualAssign()
