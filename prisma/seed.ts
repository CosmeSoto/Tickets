import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed limpio de la base de datos...')

  const now = new Date()

  // Crear o actualizar departamento de Administración
  const deptAdmin = await prisma.departments.upsert({
    where: { name: 'Administración' },
    update: {},
    create: {
      id: randomUUID(),
      name: 'Administración',
      description: 'Departamento de Administración del Sistema',
      color: '#3B82F6',
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
  })

  console.log('✅ Departamento creado/actualizado')

  // Crear o actualizar usuario administrador
  const adminPassword = await bcrypt.hash('admin123', 12)

  const admin = await prisma.users.upsert({
    where: { email: 'admin@tickets.com' },
    update: {},
    create: {
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

  console.log('✅ Usuario administrador creado/actualizado')

  // Crear o actualizar preferencias de notificación para admin
  await prisma.notification_preferences.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
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

  console.log('✅ Preferencias de notificación creadas/actualizadas')

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

  // Crear políticas de SLA profesionales (solo si no existen)
  const existingSLAs = await prisma.sla_policies.count()
  
  if (existingSLAs === 0) {
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
  } else {
    console.log('✅ Políticas de SLA ya existen, omitiendo creación')
  }

  // Crear equipos de ejemplo (solo si no existen)
  const existingEquipment = await prisma.equipment.count()
  
  if (existingEquipment === 0) {
    const equipmentData = [
    {
      id: randomUUID(),
      code: 'LAP-001',
      serialNumber: 'SN-LAP-2024-001',
      brand: 'Dell',
      model: 'Latitude 5420',
      type: 'LAPTOP',
      status: 'AVAILABLE',
      condition: 'GOOD',
      ownershipType: 'FIXED_ASSET',
      purchaseDate: new Date('2024-01-15'),
      purchasePrice: 1200.00,
      warrantyExpiration: new Date('2027-01-15'),
      specifications: {
        processor: 'Intel Core i7-1185G7',
        ram: '16GB DDR4',
        storage: '512GB SSD',
        screen: '14" FHD',
        os: 'Windows 11 Pro'
      },
      accessories: ['Cargador', 'Mouse inalámbrico', 'Maletín'],
      location: 'Bodega Principal',
      notes: 'Equipo nuevo, listo para asignación',
      qrCode: `QR-LAP-001-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      code: 'DESK-001',
      serialNumber: 'SN-DESK-2024-001',
      brand: 'HP',
      model: 'EliteDesk 800 G8',
      type: 'DESKTOP',
      status: 'AVAILABLE',
      condition: 'LIKE_NEW',
      ownershipType: 'FIXED_ASSET',
      purchaseDate: new Date('2024-02-01'),
      purchasePrice: 950.00,
      warrantyExpiration: new Date('2027-02-01'),
      specifications: {
        processor: 'Intel Core i5-11500',
        ram: '16GB DDR4',
        storage: '1TB HDD + 256GB SSD',
        graphics: 'Intel UHD Graphics 750'
      },
      accessories: ['Teclado', 'Mouse', 'Cable de poder'],
      location: 'Bodega Principal',
      notes: 'Desktop para oficina',
      qrCode: `QR-DESK-001-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      code: 'MON-001',
      serialNumber: 'SN-MON-2024-001',
      brand: 'LG',
      model: '24MK430H',
      type: 'MONITOR',
      status: 'AVAILABLE',
      condition: 'NEW',
      ownershipType: 'FIXED_ASSET',
      purchaseDate: new Date('2024-03-01'),
      purchasePrice: 180.00,
      specifications: {
        size: '24 pulgadas',
        resolution: '1920x1080 Full HD',
        panel: 'IPS',
        refreshRate: '75Hz'
      },
      accessories: ['Cable HDMI', 'Cable de poder', 'Base'],
      location: 'Bodega Principal',
      qrCode: `QR-MON-001-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      code: 'PRINT-001',
      serialNumber: 'SN-PRINT-2024-001',
      brand: 'HP',
      model: 'LaserJet Pro M404dn',
      type: 'PRINTER',
      status: 'AVAILABLE',
      condition: 'GOOD',
      ownershipType: 'FIXED_ASSET',
      purchaseDate: new Date('2023-11-15'),
      purchasePrice: 350.00,
      specifications: {
        type: 'Láser monocromático',
        speed: '38 ppm',
        connectivity: 'USB, Ethernet',
        duplexPrinting: true
      },
      accessories: ['Cable USB', 'Cable de red', 'Cable de poder', 'Toner inicial'],
      location: 'Oficina Principal',
      notes: 'Impresora compartida del departamento',
      qrCode: `QR-PRINT-001-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      code: 'PHONE-001',
      serialNumber: 'SN-PHONE-2024-001',
      brand: 'Samsung',
      model: 'Galaxy A54',
      type: 'PHONE',
      status: 'AVAILABLE',
      condition: 'NEW',
      ownershipType: 'FIXED_ASSET',
      purchaseDate: new Date('2024-03-10'),
      purchasePrice: 450.00,
      specifications: {
        screen: '6.4" Super AMOLED',
        storage: '128GB',
        ram: '6GB',
        camera: '50MP + 12MP + 5MP',
        battery: '5000mAh'
      },
      accessories: ['Cargador', 'Cable USB-C', 'Funda protectora', 'Protector de pantalla'],
      location: 'Bodega Principal',
      qrCode: `QR-PHONE-001-${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    },
  ]

  for (const equipment of equipmentData) {
    await prisma.equipment.create({
      data: equipment,
    })
  }

  console.log('✅ Equipos de ejemplo creados (5 equipos)')
  } else {
    console.log('✅ Equipos ya existen, omitiendo creación')
  }

  // Crear consumibles de ejemplo (solo si no existen)
  const existingConsumables = await prisma.consumables.count()
  
  if (existingConsumables === 0) {
    const consumablesData = [
    {
      id: randomUUID(),
      name: 'Toner HP 58A (CF258A)',
      type: 'TONER',
      unitOfMeasure: 'unidad',
      currentStock: 5,
      minStock: 2,
      maxStock: 10,
      costPerUnit: 85.00,
      compatibleEquipment: ['PRINT-001'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'Papel A4 75g (Resma)',
      type: 'PAPER',
      unitOfMeasure: 'resma',
      currentStock: 15,
      minStock: 5,
      maxStock: 30,
      costPerUnit: 4.50,
      compatibleEquipment: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'Cable HDMI 2.0 (1.8m)',
      type: 'CABLE',
      unitOfMeasure: 'unidad',
      currentStock: 8,
      minStock: 3,
      maxStock: 15,
      costPerUnit: 12.00,
      compatibleEquipment: [],
      createdAt: now,
      updatedAt: now,
    },
  ]

  for (const consumable of consumablesData) {
    await prisma.consumables.create({
      data: consumable,
    })
  }

  console.log('✅ Consumibles de ejemplo creados (3 consumibles)')
  } else {
    console.log('✅ Consumibles ya existen, omitiendo creación')
  }

  // Crear licencias de ejemplo (solo si no existen)
  const existingLicenses = await prisma.software_licenses.count()
  
  if (existingLicenses === 0) {
    const licensesData = [
    {
      id: randomUUID(),
      name: 'Windows 11 Pro',
      type: 'WINDOWS',
      key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX', // En producción esto estaría encriptado
      purchaseDate: new Date('2024-01-15'),
      expirationDate: null, // Licencia perpetua
      cost: 199.00,
      vendor: 'Microsoft',
      assignedToEquipment: null,
      assignedToUser: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      name: 'Microsoft Office 365 Business',
      type: 'OFFICE',
      key: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX',
      purchaseDate: new Date('2024-01-20'),
      expirationDate: new Date('2025-01-20'),
      cost: 99.00,
      vendor: 'Microsoft',
      assignedToEquipment: null,
      assignedToUser: null,
      createdAt: now,
      updatedAt: now,
    },
  ]

  for (const license of licensesData) {
    await prisma.software_licenses.create({
      data: license,
    })
  }

  console.log('✅ Licencias de ejemplo creadas (2 licencias)')
  } else {
    console.log('✅ Licencias ya existen, omitiendo creación')
  }

  // Inicializar contadores de folio (solo si no existen)
  const currentYear = new Date().getFullYear()
  const existingFolioCounters = await prisma.folio_counters.count({
    where: { year: currentYear }
  })
  
  if (existingFolioCounters === 0) {
    await prisma.folio_counters.createMany({
      data: [
        {
          id: randomUUID(),
          year: currentYear,
          type: 'ACT',
          lastNumber: 0,
        },
        {
          id: randomUUID(),
          year: currentYear,
          type: 'DEV',
          lastNumber: 0,
        },
      ],
    })

    console.log('✅ Contadores de folio inicializados')
  } else {
    console.log('✅ Contadores de folio ya existen, omitiendo creación')
  }

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
  console.log('\n📦 Inventario inicial:')
  console.log('   • 5 equipos de ejemplo (laptop, desktop, monitor, impresora, teléfono)')
  console.log('   • 3 consumibles (toner, papel, cables)')
  console.log('   • 2 licencias de software (Windows, Office)')
  console.log('   • Contadores de folio inicializados')
  console.log('\n💡 Ahora puedes crear usuarios, departamentos, categorías y tickets desde el panel de administración.')
  console.log('💡 Los tickets nuevos recibirán SLA automáticamente según su prioridad.')
  console.log('💡 El módulo de inventario está listo para gestionar equipos, asignaciones y actas de entrega.')
}

main()
  .catch(e => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
