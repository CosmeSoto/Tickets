/**
 * Script de diagnóstico para verificar el sistema de notificaciones
 * 
 * Ejecutar con: npx ts-node scripts/test-notifications.ts
 */

import prisma from '../src/lib/prisma'
import { NotificationService } from '../src/lib/services/notification-service'

async function main() {
  console.log('🔍 DIAGNÓSTICO DEL SISTEMA DE NOTIFICACIONES\n')
  console.log('=' .repeat(60))

  // 1. Verificar usuarios ADMIN
  console.log('\n1️⃣ Verificando usuarios ADMIN...')
  const admins = await prisma.users.findMany({
    where: {
      role: 'ADMIN',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  })

  console.log(`   ✅ Encontrados ${admins.length} administradores activos:`)
  admins.forEach((admin, index) => {
    console.log(`      ${index + 1}. ${admin.name} (${admin.email}) - ID: ${admin.id}`)
  })

  if (admins.length === 0) {
    console.log('   ⚠️  NO HAY ADMINISTRADORES ACTIVOS - Las notificaciones no se enviarán')
    return
  }

  // 2. Verificar usuarios TECHNICIAN
  console.log('\n2️⃣ Verificando usuarios TECHNICIAN...')
  const technicians = await prisma.users.findMany({
    where: {
      role: 'TECHNICIAN',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  })

  console.log(`   ✅ Encontrados ${technicians.length} técnicos activos:`)
  technicians.forEach((tech, index) => {
    console.log(`      ${index + 1}. ${tech.name} (${tech.email}) - ID: ${tech.id}`)
  })

  // 3. Verificar tickets recientes
  console.log('\n3️⃣ Verificando tickets recientes...')
  const recentTickets = await prisma.tickets.findMany({
    take: 5,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      clientId: true,
      assigneeId: true,
      createdAt: true,
    },
  })

  console.log(`   ✅ Últimos ${recentTickets.length} tickets:`)
  recentTickets.forEach((ticket, index) => {
    console.log(`      ${index + 1}. ${ticket.title} - Estado: ${ticket.status} - Asignado: ${ticket.assigneeId ? 'Sí' : 'No'}`)
  })

  // 4. Verificar notificaciones existentes
  console.log('\n4️⃣ Verificando notificaciones existentes...')
  const notifications = await prisma.notifications.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      users: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
      tickets: {
        select: {
          title: true,
        },
      },
    },
  })

  console.log(`   ✅ Últimas ${notifications.length} notificaciones:`)
  notifications.forEach((notif, index) => {
    console.log(`      ${index + 1}. [${notif.type}] ${notif.title}`)
    console.log(`         Para: ${notif.users.name} (${notif.users.role})`)
    console.log(`         Leída: ${notif.isRead ? 'Sí' : 'No'}`)
    console.log(`         Fecha: ${notif.createdAt.toLocaleString()}`)
    if (notif.tickets) {
      console.log(`         Ticket: ${notif.tickets.title}`)
    }
    console.log('')
  })

  // 5. Probar creación de notificación de prueba
  console.log('\n5️⃣ Probando creación de notificación de prueba...')
  
  if (admins.length > 0) {
    try {
      const testNotification = await NotificationService.createNotification({
        userId: admins[0].id,
        type: 'INFO',
        title: '🧪 Notificación de prueba',
        message: 'Esta es una notificación de prueba del sistema de diagnóstico',
      })

      console.log('   ✅ Notificación de prueba creada exitosamente:')
      console.log(`      ID: ${testNotification.id}`)
      console.log(`      Para: ${testNotification.users.name}`)
      console.log(`      Título: ${testNotification.title}`)
    } catch (error) {
      console.error('   ❌ Error al crear notificación de prueba:', error)
    }
  }

  // 6. Verificar estructura de la tabla notifications
  console.log('\n6️⃣ Verificando estructura de la tabla notifications...')
  const tableInfo = await prisma.$queryRaw`
    SELECT column_name, data_type, column_default, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'notifications'
    ORDER BY ordinal_position;
  `
  
  console.log('   ✅ Estructura de la tabla:')
  console.table(tableInfo)

  console.log('\n' + '='.repeat(60))
  console.log('✅ Diagnóstico completado\n')
}

main()
  .catch((error) => {
    console.error('❌ Error en el diagnóstico:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
