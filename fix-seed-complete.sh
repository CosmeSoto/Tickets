#!/bin/bash

echo "🔧 Corrigiendo seed.ts completamente..."

# Crear un archivo temporal con el seed corregido
cat > prisma/seed-fixed.ts << 'EOFFILE'
import { PrismaClient, UserRole, TicketStatus, TicketPriority } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

  // Limpiar datos existentes
  await prisma.ticket_history.deleteMany()
  await prisma.comments.deleteMany()
  await prisma.attachments.deleteMany()
  await prisma.notifications.deleteMany()
  await prisma.notification_preferences.deleteMany()
  await prisma.technician_assignments.deleteMany()
  await prisma.tickets.deleteMany()
  await prisma.categories.deleteMany()
  await prisma.audit_logs.deleteMany()
  await prisma.oauth_accounts.deleteMany()
  await prisma.sessions.deleteMany()
  await prisma.accounts.deleteMany()
  await prisma.users.deleteMany()
  await prisma.departments.deleteMany()

  const now = new Date()

  // Crear departamentos primero
  const deptTech = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Tecnología',
      description: 'Departamento de Tecnología e Innovación',
      color: '#3B82F6',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptSupport = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Soporte Técnico',
      description: 'Soporte y Atención al Usuario',
      color: '#10B981',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptDev = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Desarrollo',
      description: 'Desarrollo de Aplicaciones',
      color: '#EC4899',
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptSales = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Ventas',
      description: 'Departamento de Ventas',
      color: '#F59E0B',
      order: 4,
      createdAt: now,
      updatedAt: now,
    },
  })

  const deptMarketing = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Marketing',
      description: 'Departamento de Marketing',
      color: '#8B5CF6',
      order: 5,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Departamentos creados')

  // Crear usuarios
  const adminPassword = await bcrypt.hash('admin123', 12)
  const techPassword = await bcrypt.hash('tech123', 12)
  const clientPassword = await bcrypt.hash('client123', 12)

  const admin = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'admin@tickets.com',
      name: 'Administrador Sistema',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      departmentId: deptTech.id,
      phone: '+1234567890',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const technician1 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'tecnico1@tickets.com',
      name: 'Juan Pérez',
      passwordHash: techPassword,
      role: UserRole.TECHNICIAN,
      departmentId: deptSupport.id,
      phone: '+1234567891',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const technician2 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'tecnico2@tickets.com',
      name: 'María García',
      passwordHash: techPassword,
      role: UserRole.TECHNICIAN,
      departmentId: deptDev.id,
      phone: '+1234567892',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const client1 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'cliente1@empresa.com',
      name: 'Carlos López',
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
      departmentId: deptSales.id,
      phone: '+1234567893',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  const client2 = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'cliente2@empresa.com',
      name: 'Ana Martínez',
      passwordHash: clientPassword,
      role: UserRole.CLIENT,
      departmentId: deptMarketing.id,
      phone: '+1234567894',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Usuarios creados')

  // Crear categorías jerárquicas
  const hardwareCategory = await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Hardware',
      description: 'Problemas relacionados con hardware',
      level: 1,
      color: '#EF4444',
      order: 1,
      departmentId: deptSupport.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const softwareCategory = await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Software',
      description: 'Problemas relacionados con software',
      level: 1,
      color: '#3B82F6',
      order: 2,
      departmentId: deptDev.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const networkCategory = await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Red y Conectividad',
      description: 'Problemas de red e internet',
      level: 1,
      color: '#10B981',
      order: 3,
      departmentId: deptTech.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  // Subcategorías
  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Computadoras',
      description: 'Problemas con PCs y laptops',
      level: 2,
      parentId: hardwareCategory.id,
      color: '#F87171',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Impresoras',
      description: 'Problemas con impresoras',
      level: 2,
      parentId: hardwareCategory.id,
      color: '#F87171',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Aplicaciones',
      description: 'Problemas con aplicaciones',
      level: 2,
      parentId: softwareCategory.id,
      color: '#60A5FA',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.categories.create({
    data: {
      id: randomUUID(),
      name: 'Sistema Operativo',
      description: 'Problemas con Windows/Mac/Linux',
      level: 2,
      parentId: softwareCategory.id,
      color: '#60A5FA',
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Categorías creadas')

  // Crear asignaciones de técnicos
  await prisma.technician_assignments.create({
    data: {
      id: randomUUID(),
      technicianId: technician1.id,
      categoryId: hardwareCategory.id,
      priority: 1,
      maxTickets: 10,
      autoAssign: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.technician_assignments.create({
    data: {
      id: randomUUID(),
      technicianId: technician2.id,
      categoryId: softwareCategory.id,
      priority: 1,
      maxTickets: 15,
      autoAssign: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.technician_assignments.create({
    data: {
      id: randomUUID(),
      technicianId: technician1.id,
      categoryId: networkCategory.id,
      priority: 2,
      maxTickets: 8,
      autoAssign: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Asignaciones de técnicos creadas')

  // Crear tickets de ejemplo
  const ticket1 = await prisma.tickets.create({
    data: {
      id: randomUUID(),
      title: 'Computadora no enciende',
      description: 'La computadora del escritorio no enciende después del corte de luz de ayer.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      clientId: client1.id,
      categoryId: hardwareCategory.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const ticket2 = await prisma.tickets.create({
    data: {
      id: randomUUID(),
      title: 'Error en aplicación de ventas',
      description: 'La aplicación de ventas se cierra inesperadamente al intentar generar reportes.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.MEDIUM,
      clientId: client2.id,
      assigneeId: technician2.id,
      categoryId: softwareCategory.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  const ticket3 = await prisma.tickets.create({
    data: {
      id: randomUUID(),
      title: 'Internet lento en oficina',
      description: 'La conexión a internet está muy lenta en toda la oficina desde esta mañana.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      clientId: client1.id,
      assigneeId: technician1.id,
      categoryId: networkCategory.id,
      resolvedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Tickets de ejemplo creados')

  // Crear comentarios
  await prisma.comments.create({
    data: {
      id: randomUUID(),
      content: 'He revisado el ticket y necesito más información sobre el modelo de la computadora.',
      isInternal: false,
      ticketId: ticket1.id,
      authorId: technician1.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.comments.create({
    data: {
      id: randomUUID(),
      content: 'Es una Dell OptiPlex 7090, comprada el año pasado.',
      isInternal: false,
      ticketId: ticket1.id,
      authorId: client1.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  await prisma.comments.create({
    data: {
      id: randomUUID(),
      content: 'Nota interna: Revisar fuente de poder, posible daño por sobretensión.',
      isInternal: true,
      ticketId: ticket1.id,
      authorId: technician1.id,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Comentarios creados')

  // Crear historial de tickets
  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      action: 'created',
      comment: 'Ticket creado por el cliente',
      ticketId: ticket1.id,
      userId: client1.id,
      createdAt: now,
    },
  })

  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      action: 'assigned',
      field: 'assigneeId',
      newValue: technician2.id,
      comment: 'Ticket asignado automáticamente',
      ticketId: ticket2.id,
      userId: admin.id,
      createdAt: now,
    },
  })

  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      action: 'status_changed',
      field: 'status',
      oldValue: 'OPEN',
      newValue: 'IN_PROGRESS',
      comment: 'Técnico comenzó a trabajar en el ticket',
      ticketId: ticket2.id,
      userId: technician2.id,
      createdAt: now,
    },
  })

  console.log('✅ Historial de tickets creado')

  // Crear preferencias de notificación
  await prisma.notification_preferences.create({
    data: {
      userId: admin.id,
      emailEnabled: true,
      teamsEnabled: false,
      inAppEnabled: true,
      ticketCreated: true,
      ticketUpdated: true,
      ticketAssigned: true,
      ticketResolved: true,
      commentAdded: true,
    },
  })

  await prisma.notification_preferences.create({
    data: {
      userId: technician1.id,
      emailEnabled: true,
      teamsEnabled: false,
      inAppEnabled: true,
      ticketCreated: false,
      ticketUpdated: true,
      ticketAssigned: true,
      ticketResolved: false,
      commentAdded: true,
    },
  })

  console.log('✅ Preferencias de notificación creadas')

  // Crear notificaciones de ejemplo
  await prisma.notifications.create({
    data: {
      id: randomUUID(),
      title: 'Nuevo ticket asignado',
      message: 'Se te ha asignado el ticket: Error en aplicación de ventas',
      type: 'INFO',
      userId: technician2.id,
      ticketId: ticket2.id,
      isRead: false,
      createdAt: now,
    },
  })

  await prisma.notifications.create({
    data: {
      id: randomUUID(),
      title: 'Ticket resuelto',
      message: 'Tu ticket "Internet lento en oficina" ha sido resuelto',
      type: 'SUCCESS',
      userId: client1.id,
      ticketId: ticket3.id,
      isRead: true,
      createdAt: now,
    },
  })

  console.log('✅ Notificaciones creadas')

  // Crear configuración del sitio
  const siteConfigs = [
    {
      id: randomUUID(),
      key: 'site_name',
      value: 'Sistema de Tickets Moderno',
      description: 'Nombre del sitio web',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'company_name',
      value: 'Mi Empresa',
      description: 'Nombre de la empresa',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'support_email',
      value: 'soporte@miempresa.com',
      description: 'Email de soporte técnico',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'max_file_size',
      value: '10485760',
      description: 'Tamaño máximo de archivo en bytes (10MB)',
      updatedAt: now,
    },
    {
      id: randomUUID(),
      key: 'allowed_file_types',
      value: 'pdf,doc,docx,txt,png,jpg,jpeg,gif',
      description: 'Tipos de archivo permitidos',
      updatedAt: now,
    },
  ]

  for (const config of siteConfigs) {
    await prisma.site_config.upsert({
      where: { key: config.key },
      update: config,
      create: config,
    })
  }

  console.log('✅ Configuración del sitio creada')

  console.log('🎉 Seed completado exitosamente!')
  console.log('\n📋 Usuarios creados:')
  console.log('👤 Admin: admin@tickets.com / admin123')
  console.log('🔧 Técnico 1: tecnico1@tickets.com / tech123')
  console.log('🔧 Técnico 2: tecnico2@tickets.com / tech123')
  console.log('👥 Cliente 1: cliente1@empresa.com / client123')
  console.log('👥 Cliente 2: cliente2@empresa.com / client123')
}

main()
  .catch(e => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
EOFFILE

# Reemplazar el archivo original
mv prisma/seed-fixed.ts prisma/seed.ts

echo "✅ Seed corregido completamente"
