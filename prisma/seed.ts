import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const now = new Date()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...\n')

  // 1. DEPARTAMENTOS
  const deptMap = await seedDepartments()

  // 2. USUARIO ADMINISTRADOR
  await seedAdmin(deptMap.get('Administración')!)

  // 3. CONFIGURACIÓN DEL SITIO
  await seedSiteConfig()

  // 4. POLÍTICAS DE SLA
  await seedSLAPolicies()

  // 5. CATEGORÍAS
  await seedCategories(deptMap.get('Tecnología')!)

  // 6. TIPOS DE EQUIPO
  await seedEquipmentTypes()

  // 7. CONFIGURACIONES DE INVENTARIO
  await seedInventorySettings()

  // 8. CONTADORES DE FOLIO
  await seedFolioCounters()

  // 9. LANDING PAGE + SERVICIOS
  await seedLandingPage()

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('\n📋 Credenciales de acceso:')
  console.log('   Email: admin@tickets.com')
  console.log('   Contraseña: admin123')
}

// ============================================
// HELPERS
// ============================================

/**
 * Busca categoría por nombre+parentId+level. Si existe la actualiza, si no la crea.
 */
async function upsertCategory(data: {
  name: string; description: string; level: number;
  parentId: string | null; departmentId: string; order: number; color: string;
}) {
  const existing = await prisma.categories.findFirst({
    where: { name: data.name, level: data.level, parentId: data.parentId },
  })
  if (existing) {
    return prisma.categories.update({
      where: { id: existing.id },
      data: { description: data.description, departmentId: data.departmentId, order: data.order, color: data.color, updatedAt: now },
    })
  }
  return prisma.categories.create({
    data: { id: randomUUID(), ...data, isActive: true, createdAt: now, updatedAt: now },
  })
}

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedDepartments(): Promise<Map<string, string>> {
  const departments = [
    { name: 'Administración', description: 'Departamento de Administración del Sistema', color: '#3B82F6', order: 1 },
    { name: 'Tecnología', description: 'Departamento de Tecnología e Informática', color: '#10B981', order: 2 },
    { name: 'Soporte', description: 'Departamento de Soporte Técnico', color: '#F59E0B', order: 3 },
    { name: 'Recursos Humanos', description: 'Departamento de Recursos Humanos', color: '#8B5CF6', order: 4 },
    { name: 'Contabilidad', description: 'Departamento de Contabilidad y Finanzas', color: '#EF4444', order: 5 },
  ]
  const map = new Map<string, string>()
  for (const dept of departments) {
    const d = await prisma.departments.upsert({
      where: { name: dept.name },
      update: { description: dept.description, color: dept.color, order: dept.order },
      create: { id: randomUUID(), ...dept, createdAt: now, updatedAt: now },
    })
    map.set(dept.name, d.id)
  }
  console.log(`✅ ${departments.length} departamentos`)
  return map
}

async function seedAdmin(deptAdminId: string) {
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.users.upsert({
    where: { email: 'admin@tickets.com' },
    update: {},
    create: {
      id: randomUUID(), email: 'admin@tickets.com', name: 'Administrador del Sistema',
      passwordHash: adminPassword, role: UserRole.ADMIN, departmentId: deptAdminId,
      phone: '+593999999999', isActive: true, isEmailVerified: true, createdAt: now, updatedAt: now,
    },
  })
  await prisma.notification_preferences.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id, emailEnabled: true, teamsEnabled: false, inAppEnabled: true,
      ticketCreated: true, ticketUpdated: true, ticketAssigned: true, ticketResolved: true, commentAdded: true,
    },
  })
  console.log('✅ Usuario administrador (admin@tickets.com / admin123)')
}

async function seedSiteConfig() {
  const configs = [
    { key: 'site_name', value: 'Sistema de Tickets', description: 'Nombre del sitio web' },
    { key: 'company_name', value: 'Mi Empresa', description: 'Nombre de la empresa' },
    { key: 'support_email', value: 'soporte@miempresa.com', description: 'Email de soporte técnico' },
    { key: 'max_file_size', value: '10485760', description: 'Tamaño máximo de archivo en bytes (10MB)' },
    { key: 'allowed_file_types', value: 'pdf,doc,docx,txt,png,jpg,jpeg,gif', description: 'Tipos de archivo permitidos' },
  ]
  for (const c of configs) {
    await prisma.site_config.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description },
      create: { id: randomUUID(), ...c, updatedAt: now },
    })
  }
  console.log(`✅ ${configs.length} configuraciones del sitio`)
}

async function seedSLAPolicies() {
  const existing = await prisma.sla_policies.count()
  if (existing > 0) { console.log(`⏭️  SLA ya existe (${existing})`); return }
  const policies = [
    { name: 'SLA Urgente - 24/7', priority: 'URGENT', responseTimeHours: 1, resolutionTimeHours: 4, businessHoursOnly: false, businessHoursStart: '00:00:00', businessHoursEnd: '23:59:59', businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN' },
    { name: 'SLA Alta Prioridad', priority: 'HIGH', responseTimeHours: 4, resolutionTimeHours: 24, businessHoursOnly: true, businessHoursStart: '09:00:00', businessHoursEnd: '18:00:00', businessDays: 'MON,TUE,WED,THU,FRI' },
    { name: 'SLA Prioridad Media', priority: 'MEDIUM', responseTimeHours: 8, resolutionTimeHours: 48, businessHoursOnly: true, businessHoursStart: '09:00:00', businessHoursEnd: '18:00:00', businessDays: 'MON,TUE,WED,THU,FRI' },
    { name: 'SLA Baja Prioridad', priority: 'LOW', responseTimeHours: 24, resolutionTimeHours: 72, businessHoursOnly: true, businessHoursStart: '09:00:00', businessHoursEnd: '18:00:00', businessDays: 'MON,TUE,WED,THU,FRI' },
  ]
  for (const p of policies) {
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true, createdAt: now, updatedAt: now } })
  }
  console.log(`✅ ${policies.length} políticas de SLA`)
}

async function seedCategories(deptTIId: string) {
  // Nivel 1
  const hardware = await upsertCategory({ name: 'Hardware', description: 'Problemas con equipos físicos, computadoras, laptops, monitores, teclados, mouse, impresoras, escáneres, dispositivos, periféricos, componentes, hardware', level: 1, parentId: null, departmentId: deptTIId, order: 1, color: '#3B82F6' })
  const software = await upsertCategory({ name: 'Software', description: 'Problemas con programas, aplicaciones, apps, instalación, desinstalación, actualización, licencias, errores de software, no abre, crash', level: 1, parentId: null, departmentId: deptTIId, order: 2, color: '#8B5CF6' })
  const red = await upsertCategory({ name: 'Red e Internet', description: 'Problemas con conexión, conectividad, network, LAN, WiFi, ethernet, cable, router, switch, internet, no hay internet, sin conexión', level: 1, parentId: null, departmentId: deptTIId, order: 3, color: '#10B981' })
  const acceso = await upsertCategory({ name: 'Acceso y Seguridad', description: 'Problemas con login, inicio de sesión, contraseña, password, usuario, credenciales, autenticación, no puedo entrar, olvidé contraseña', level: 1, parentId: null, departmentId: deptTIId, order: 4, color: '#EF4444' })

  // Nivel 2 - Hardware
  await upsertCategory({ name: 'Computadoras', description: 'Problemas con PC, desktop, torre, equipo de escritorio, no enciende, pantalla negra, lento', level: 2, parentId: hardware.id, departmentId: deptTIId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Impresoras', description: 'Problemas con impresión, tóner, tinta, papel, atasco, escáner, fotocopiadora, no imprime', level: 2, parentId: hardware.id, departmentId: deptTIId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Monitores', description: 'Problemas con pantalla, display, resolución, brillo, colores, imagen, video, no enciende', level: 2, parentId: hardware.id, departmentId: deptTIId, order: 3, color: '#3B82F6' })
  await upsertCategory({ name: 'Periféricos', description: 'Problemas con teclado, mouse, auriculares, webcam, USB, dispositivos externos', level: 2, parentId: hardware.id, departmentId: deptTIId, order: 4, color: '#3B82F6' })

  // Nivel 2 - Software
  await upsertCategory({ name: 'Microsoft Office', description: 'Problemas con Word, Excel, PowerPoint, Outlook, documentos, hojas de cálculo', level: 2, parentId: software.id, departmentId: deptTIId, order: 1, color: '#8B5CF6' })
  await upsertCategory({ name: 'Sistema Operativo', description: 'Problemas con Windows, Linux, macOS, arranque, inicio, boot, actualización del sistema, pantalla azul', level: 2, parentId: software.id, departmentId: deptTIId, order: 2, color: '#8B5CF6' })
  await upsertCategory({ name: 'Navegadores', description: 'Problemas con Chrome, Firefox, Edge, Safari, páginas no cargan, lento, extensiones', level: 2, parentId: software.id, departmentId: deptTIId, order: 3, color: '#8B5CF6' })
  await upsertCategory({ name: 'Antivirus y Seguridad', description: 'Problemas con antivirus, malware, virus, amenazas, firewall, protección', level: 2, parentId: software.id, departmentId: deptTIId, order: 4, color: '#8B5CF6' })

  // Nivel 2 - Red e Internet
  await upsertCategory({ name: 'WiFi', description: 'Problemas con red inalámbrica, wireless, señal, cobertura, contraseña WiFi, no conecta, señal débil', level: 2, parentId: red.id, departmentId: deptTIId, order: 1, color: '#10B981' })
  await upsertCategory({ name: 'Correo Electrónico', description: 'Problemas con email, Outlook, Gmail, enviar, recibir, adjuntos, buzón, no llegan correos', level: 2, parentId: red.id, departmentId: deptTIId, order: 2, color: '#10B981' })
  await upsertCategory({ name: 'VPN', description: 'Problemas con red privada virtual, acceso remoto, conexión segura, túnel, VPN no conecta', level: 2, parentId: red.id, departmentId: deptTIId, order: 3, color: '#10B981' })
  await upsertCategory({ name: 'Red Cableada', description: 'Problemas con ethernet, cable de red, switch, router, puerto de red, sin conexión por cable', level: 2, parentId: red.id, departmentId: deptTIId, order: 4, color: '#10B981' })

  // Nivel 2 - Acceso y Seguridad
  await upsertCategory({ name: 'Contraseñas', description: 'Problemas con password, clave, resetear contraseña, olvidé mi contraseña, cambiar password, bloqueado', level: 2, parentId: acceso.id, departmentId: deptTIId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Cuentas de Usuario', description: 'Problemas con cuenta bloqueada, deshabilitada, permisos, acceso denegado, crear usuario', level: 2, parentId: acceso.id, departmentId: deptTIId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Permisos y Accesos', description: 'Problemas con autorización, privilegios, carpetas compartidas, recursos, acceso a sistemas', level: 2, parentId: acceso.id, departmentId: deptTIId, order: 3, color: '#EF4444' })

  console.log('✅ Categorías (4 principales + 15 subcategorías)')
}

async function seedEquipmentTypes() {
  const types = [
    { code: 'LAPTOP', name: 'Laptop', icon: 'Laptop', order: 1 },
    { code: 'DESKTOP', name: 'Desktop', icon: 'Monitor', order: 2 },
    { code: 'MONITOR', name: 'Monitor', icon: 'Monitor', order: 3 },
    { code: 'PRINTER', name: 'Impresora', icon: 'Printer', order: 4 },
    { code: 'PHONE', name: 'Teléfono', icon: 'Phone', order: 5 },
    { code: 'TABLET', name: 'Tablet', icon: 'Tablet', order: 6 },
    { code: 'KEYBOARD', name: 'Teclado', icon: 'Keyboard', order: 7 },
    { code: 'MOUSE', name: 'Mouse', icon: 'Mouse', order: 8 },
    { code: 'HEADSET', name: 'Audífonos', icon: 'Headphones', order: 9 },
    { code: 'WEBCAM', name: 'Webcam', icon: 'Camera', order: 10 },
    { code: 'DOCKING_STATION', name: 'Docking Station', icon: 'Cpu', order: 11 },
    { code: 'UPS', name: 'UPS', icon: 'Battery', order: 12 },
    { code: 'ROUTER', name: 'Router', icon: 'Router', order: 13 },
    { code: 'SWITCH', name: 'Switch de Red', icon: 'Wifi', order: 14 },
    { code: 'OTHER', name: 'Otro', icon: 'Box', order: 15 },
  ]
  for (const t of types) {
    await prisma.equipment_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order },
      create: { id: randomUUID(), ...t, isActive: true, createdAt: now, updatedAt: now },
    })
  }
  console.log(`✅ ${types.length} tipos de equipo`)
}

async function seedInventorySettings() {
  const settings = [
    { key: 'inventory.technician_can_manage_equipment', value: 'true', description: 'Permite a los técnicos gestionar equipos' },
    { key: 'inventory.inventory_technician_ids', value: '[]', description: 'IDs de técnicos con acceso al inventario' },
    { key: 'inventory.act_expiration_days', value: '7', description: 'Días de expiración para actas' },
    { key: 'inventory.low_stock_alert_enabled', value: 'true', description: 'Habilitar alertas de stock bajo' },
    { key: 'inventory.license_alert_enabled', value: 'true', description: 'Habilitar alertas de vencimiento de licencias' },
    { key: 'inventory.license_alert_days_first', value: '30', description: 'Días antes para primera alerta de licencias' },
    { key: 'inventory.license_alert_days_second', value: '7', description: 'Días antes para segunda alerta de licencias' },
  ]
  for (const s of settings) {
    await prisma.system_settings.upsert({
      where: { key: s.key },
      update: { description: s.description },
      create: { id: randomUUID(), ...s, updatedAt: now },
    })
  }
  console.log(`✅ ${settings.length} configuraciones de inventario`)
}

async function seedFolioCounters() {
  const year = new Date().getFullYear()
  const existing = await prisma.folio_counters.count({ where: { year } })
  if (existing > 0) { console.log(`⏭️  Contadores de folio ya existen para ${year}`); return }
  await prisma.folio_counters.createMany({
    data: [
      { id: randomUUID(), year, type: 'ACT', lastNumber: 0 },
      { id: randomUUID(), year, type: 'DEV', lastNumber: 0 },
    ],
  })
  console.log('✅ Contadores de folio')
}

async function seedLandingPage() {
  // Contenido principal
  const existingContent = await prisma.landing_page_content.count()
  if (existingContent === 0) {
    await prisma.landing_page_content.create({
      data: {
        id: randomUUID(),
        heroTitle: 'Soporte Técnico Profesional',
        heroSubtitle: 'Resolvemos tus problemas técnicos de manera rápida y eficiente',
        heroCtaPrimary: 'Crear Ticket de Soporte',
        heroCtaPrimaryUrl: '/login',
        heroCtaSecondary: 'Ver Servicios',
        heroCtaSecondaryUrl: '#servicios',
        servicesTitle: 'Nuestros Servicios',
        servicesSubtitle: 'Ofrecemos soporte técnico integral para todas tus necesidades tecnológicas',
        servicesEnabled: true,
        companyName: 'Sistema de Tickets',
        companyTagline: 'Soporte técnico profesional',
        footerText: `© ${new Date().getFullYear()} Sistema de Tickets. Todos los derechos reservados.`,
        metaTitle: 'Sistema de Tickets - Soporte Técnico Profesional',
        metaDescription: 'Sistema profesional de gestión de tickets de soporte técnico',
        showStats: false, showTestimonials: false, showFaq: false,
      },
    })
  }

  // Servicios de la landing page
  const services = [
    { id: 'service-1', order: 1, enabled: true, icon: 'Wrench', iconColor: 'blue', title: 'Soporte Técnico', description: 'Atención y resolución de incidencias técnicas a través de nuestro sistema de tickets con seguimiento en tiempo real.' },
    { id: 'service-2', order: 2, enabled: true, icon: 'Server', iconColor: 'green', title: 'Gestión de Inventario', description: 'Control y administración de equipos tecnológicos, asignaciones y actas de entrega digitales.' },
    { id: 'service-3', order: 3, enabled: true, icon: 'Shield', iconColor: 'orange', title: 'Licencias de Software', description: 'Administración centralizada de licencias de software con alertas de vencimiento y renovación.' },
  ]
  for (const s of services) {
    await prisma.landing_page_services.upsert({
      where: { id: s.id },
      update: { title: s.title, description: s.description, icon: s.icon, iconColor: s.iconColor, order: s.order },
      create: s,
    })
  }
  console.log('✅ Landing page + 3 servicios')
}

main()
  .catch(e => { console.error('❌ Error durante el seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
