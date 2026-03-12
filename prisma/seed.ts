import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed limpio de la base de datos...')

  const now = new Date()

  // Crear departamento de Administración
  const deptAdmin = await prisma.departments.create({
    data: {
      id: randomUUID(),
      name: 'Administración',
      description: 'Departamento de Administración del Sistema',
      color: '#3B82F6',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Departamento creado')

  // Crear usuario administrador
  const adminPassword = await bcrypt.hash('admin123', 12)

  const admin = await prisma.users.create({
    data: {
      id: randomUUID(),
      email: 'admin@tickets.com',
      name: 'Administrador del Sistema',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      departmentId: deptAdmin.id,
      phone: '+593999999999',
      isActive: true,
      isEmailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Usuario administrador creado')

  // Crear preferencias de notificación para admin
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

  console.log('✅ Preferencias de notificación creadas')

  // Crear configuración del sitio
  const siteConfigs = [
    {
      id: randomUUID(),
      key: 'site_name',
      value: 'Sistema de Tickets',
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

  // Crear políticas de SLA profesionales
  const slaPolicies = [
    {
      id: randomUUID(),
      name: 'SLA Urgente - 24/7',
      description: 'Política de SLA para tickets de prioridad urgente. Respuesta inmediata y resolución en 4 horas. Aplica 24/7 incluyendo fines de semana.',
      categoryId: null, // Aplica a todas las categorías
      priority: 'URGENT',
      responseTimeHours: 1,
      resolutionTimeHours: 4,
      businessHoursOnly: false, // 24/7
      businessHoursStart: '00:00:00',
      businessHoursEnd: '23:59:59',
      businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'SLA Alta Prioridad',
      description: 'Política de SLA para tickets de alta prioridad. Respuesta en 4 horas y resolución en 24 horas durante horario laboral.',
      categoryId: null,
      priority: 'HIGH',
      responseTimeHours: 4,
      resolutionTimeHours: 24,
      businessHoursOnly: true, // Solo horas laborales
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'SLA Prioridad Media',
      description: 'Política de SLA para tickets de prioridad media. Respuesta en 8 horas y resolución en 48 horas durante horario laboral.',
      categoryId: null,
      priority: 'MEDIUM',
      responseTimeHours: 8,
      resolutionTimeHours: 48,
      businessHoursOnly: true,
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'SLA Baja Prioridad',
      description: 'Política de SLA para tickets de baja prioridad. Respuesta en 24 horas y resolución en 72 horas durante horario laboral.',
      categoryId: null,
      priority: 'LOW',
      responseTimeHours: 24,
      resolutionTimeHours: 72,
      businessHoursOnly: true,
      businessHoursStart: '09:00:00',
      businessHoursEnd: '18:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]

  for (const policy of slaPolicies) {
    await prisma.sla_policies.create({
      data: policy,
    })
  }

  console.log('✅ Políticas de SLA creadas (4 políticas)')

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('\n📋 Credenciales de acceso:')
  console.log('👤 Administrador:')
  console.log('   Email: admin@tickets.com')
  console.log('   Contraseña: admin123')
  console.log('\n📊 Políticas de SLA configuradas:')
  console.log('   • URGENT: Respuesta 1h, Resolución 4h (24/7)')
  console.log('   • HIGH: Respuesta 4h, Resolución 24h (Laboral)')
  console.log('   • MEDIUM: Respuesta 8h, Resolución 48h (Laboral)')
  console.log('   • LOW: Respuesta 24h, Resolución 72h (Laboral)')
  console.log('\n💡 Ahora puedes crear usuarios, departamentos, categorías y tickets desde el panel de administración.')
  console.log('💡 Los tickets nuevos recibirán SLA automáticamente según su prioridad.')
}

main()
  .catch(e => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
