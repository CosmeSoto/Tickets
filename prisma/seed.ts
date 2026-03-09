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

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('\n📋 Credenciales de acceso:')
  console.log('👤 Administrador:')
  console.log('   Email: admin@tickets.com')
  console.log('   Contraseña: admin123')
  console.log('\n💡 Ahora puedes crear usuarios, departamentos, categorías y tickets desde el panel de administración.')
}

main()
  .catch(e => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
