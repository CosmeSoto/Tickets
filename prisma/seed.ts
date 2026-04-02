import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()
const now = new Date()
const year = now.getFullYear()

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🌱 Iniciando seed multi-familia desde cero...\n')

  // 1. FAMILIAS GLOBALES (primero — todo depende de ellas)
  const familyMap = await seedFamilies()

  // 2. CONFIGURACIONES DE TICKETS POR FAMILIA
  await seedTicketFamilyConfigs(familyMap)

  // 3. CONFIGURACIONES DE INVENTARIO POR FAMILIA
  await seedInventoryFamilyConfigs(familyMap)

  // 4. DEPARTAMENTOS (con familyId directo)
  const deptMap = await seedDepartments(familyMap)

  // 5. USUARIO ADMINISTRADOR
  const adminId = await seedAdmin(deptMap.get('Administración')!)

  // 6. CONFIGURACIÓN DEL SITIO
  await seedSiteConfig()

  // 8. POLÍTICAS DE SLA (globales + por familia TECHNOLOGY)
  await seedSLAPolicies(familyMap)

  // 9. CATEGORÍAS (todas bajo TECHNOLOGY)
  await seedCategories(deptMap)

  // 10. TIPOS DE EQUIPO (con familyId directo)
  await seedEquipmentTypes(familyMap)

  // 11. TIPOS DE LICENCIA (con familyId directo)
  await seedLicenseTypes(familyMap)

  // 12. TIPOS DE CONSUMIBLE (con familyId directo)
  await seedConsumableTypes(familyMap)

  // 13. UNIDADES DE MEDIDA
  await seedUnitsOfMeasure()

  // 14. CONFIGURACIONES DE INVENTARIO (system_settings)
  await seedInventorySettings()

  // 15. CONTADORES DE FOLIO
  await seedFolioCounters()

  // 16. CONTADORES DE CÓDIGO DE TICKET
  await seedTicketCodeCounters(familyMap)

  // 17. BODEGA POR DEFECTO
  await seedDefaultWarehouse()

  // 18. LANDING PAGE
  await seedLandingPage()

  // 19. ARTÍCULOS DE BASE DE CONOCIMIENTOS
  await seedKnowledgeArticles(familyMap, deptMap, adminId)

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('\n📋 Credenciales de acceso:')
  console.log('   Email: internet.freecom@gmail.com')
  console.log('   Contraseña: admin123')
}

// ============================================
// HELPERS
// ============================================

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
// 1. FAMILIAS GLOBALES
// ============================================

async function seedFamilies(): Promise<Map<string, string>> {
  const families = [
    { code: 'TECHNOLOGY',     name: 'Tecnología y Comunicaciones',     icon: 'Monitor',     color: '#3B82F6', order: 1 },
    { code: 'FIXED_ASSETS',   name: 'Activos Fijos e Infraestructura', icon: 'Building2',   color: '#F59E0B', order: 2 },
    { code: 'MAINTENANCE',    name: 'Mantenimiento',                   icon: 'Wrench',      color: '#10B981', order: 3 },
    { code: 'SERVICES',       name: 'Servicios Generales',             icon: 'Settings',    color: '#8B5CF6', order: 4 },
    { code: 'SECURITY',       name: 'Seguridad',                       icon: 'Shield',      color: '#EF4444', order: 5 },
    { code: 'GREEN_AREAS',    name: 'Áreas Verdes',                    icon: 'Leaf',        color: '#22C55E', order: 6 },
    { code: 'ADMINISTRATIVE', name: 'Gestión Administrativa',          icon: 'Briefcase',   color: '#6B7280', order: 7 },
    { code: 'COMMERCIAL',     name: 'Comercial y Marketing',           icon: 'TrendingUp',  color: '#EC4899', order: 8 },
  ]
  const map = new Map<string, string>()
  for (const f of families) {
    const family = await prisma.families.upsert({
      where: { code: f.code },
      update: { name: f.name, icon: f.icon, color: f.color, order: f.order },
      create: { id: randomUUID(), ...f, isActive: true },
    })
    map.set(f.code, family.id)
  }
  console.log(`✅ ${families.length} familias globales`)
  return map
}

// ============================================
// 2. CONFIGURACIONES DE TICKETS POR FAMILIA
// ============================================

async function seedTicketFamilyConfigs(familyMap: Map<string, string>) {
  // Familias con tickets habilitados
  const enabledFamilies = [
    { code: 'TECHNOLOGY',     prefix: 'TI',   isDefault: true  },
    { code: 'FIXED_ASSETS',   prefix: 'INF',  isDefault: false },
    { code: 'MAINTENANCE',    prefix: 'MNT',  isDefault: false },
    { code: 'SERVICES',       prefix: 'SRV',  isDefault: false },
    { code: 'SECURITY',       prefix: 'SEG',  isDefault: false },
    { code: 'ADMINISTRATIVE', prefix: 'ADM',  isDefault: false },
    { code: 'COMMERCIAL',     prefix: 'COM',  isDefault: false },
  ]
  // GREEN_AREAS: ticketsEnabled = false
  const disabledFamilies = ['GREEN_AREAS']

  for (const f of enabledFamilies) {
    const familyId = familyMap.get(f.code)!
    await prisma.ticket_family_config.upsert({
      where: { familyId },
      update: { codePrefix: f.prefix, isDefault: f.isDefault, ticketsEnabled: true },
      create: {
        id: randomUUID(), familyId,
        ticketsEnabled: true, codePrefix: f.prefix, isDefault: f.isDefault,
        autoAssignRespectsFamilies: true, alertVolumeThreshold: 50,
        businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00',
        businessDays: 'MON,TUE,WED,THU,FRI',
      },
    })
  }
  for (const code of disabledFamilies) {
    const familyId = familyMap.get(code)!
    await prisma.ticket_family_config.upsert({
      where: { familyId },
      update: { ticketsEnabled: false },
      create: {
        id: randomUUID(), familyId, ticketsEnabled: false,
        codePrefix: code.slice(0, 5), isDefault: false,
        autoAssignRespectsFamilies: true,
        businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00',
        businessDays: 'MON,TUE,WED,THU,FRI',
      },
    })
  }
  console.log('✅ Configuraciones de tickets por familia')
}

// ============================================
// 3. CONFIGURACIONES DE INVENTARIO POR FAMILIA
// ============================================

async function seedInventoryFamilyConfigs(familyMap: Map<string, string>) {
  const configs: Record<string, { allowedSubtypes: any[]; visibleSections: any[]; requiredSections: any[] }> = {
    TECHNOLOGY:     { allowedSubtypes: ['EQUIPMENT','LICENSE','MRO'], visibleSections: ['FINANCIAL','DEPRECIATION','CONTRACT','WAREHOUSE'], requiredSections: ['FINANCIAL'] },
    FIXED_ASSETS:   { allowedSubtypes: ['EQUIPMENT','LICENSE','MRO'], visibleSections: ['FINANCIAL','DEPRECIATION','CONTRACT','WAREHOUSE'], requiredSections: ['FINANCIAL','DEPRECIATION'] },
    MAINTENANCE:    { allowedSubtypes: ['MRO'],                       visibleSections: ['FINANCIAL','STOCK_MRO','WAREHOUSE'],              requiredSections: ['FINANCIAL'] },
    SERVICES:       { allowedSubtypes: ['MRO','LICENSE'],             visibleSections: ['FINANCIAL','CONTRACT','STOCK_MRO'],              requiredSections: [] },
    SECURITY:       { allowedSubtypes: ['EQUIPMENT','MRO'],           visibleSections: ['FINANCIAL','DEPRECIATION','WAREHOUSE'],          requiredSections: ['FINANCIAL'] },
    GREEN_AREAS:    { allowedSubtypes: ['MRO'],                       visibleSections: ['FINANCIAL','STOCK_MRO'],                         requiredSections: [] },
    ADMINISTRATIVE: { allowedSubtypes: ['EQUIPMENT','LICENSE'],       visibleSections: ['FINANCIAL','CONTRACT'],                          requiredSections: [] },
    COMMERCIAL:     { allowedSubtypes: ['EQUIPMENT','LICENSE'],       visibleSections: ['FINANCIAL','DEPRECIATION','CONTRACT'],           requiredSections: ['FINANCIAL'] },
  }
  for (const [code, cfg] of Object.entries(configs)) {
    const familyId = familyMap.get(code)!
    await prisma.inventory_family_config.upsert({
      where: { familyId },
      update: { allowedSubtypes: cfg.allowedSubtypes as any, visibleSections: cfg.visibleSections as any, requiredSections: cfg.requiredSections as any },
      create: {
        id: randomUUID(), familyId,
        allowedSubtypes: cfg.allowedSubtypes as any,
        visibleSections: cfg.visibleSections as any,
        requiredSections: cfg.requiredSections as any,
        requireFinancialForNew: true,
        autoApproveDecommission: false,
        requireDeliveryAct: true,
      },
    })
  }
  console.log('✅ Configuraciones de inventario por familia')
}

// ============================================
// 4. DEPARTAMENTOS (con familyId directo)
// ============================================

async function seedDepartments(familyMap: Map<string, string>): Promise<Map<string, string>> {
  const departments = [
    // ADMINISTRATIVE
    { name: 'Administración',              description: 'Departamento de Administración del Sistema',    color: '#3B82F6', order: 1,  familyCode: 'ADMINISTRATIVE' },
    { name: 'Contabilidad',                description: 'Departamento de Contabilidad y Finanzas',       color: '#EF4444', order: 2,  familyCode: 'ADMINISTRATIVE' },
    { name: 'Compras',                     description: 'Departamento de Compras y Adquisiciones',       color: '#06B6D4', order: 3,  familyCode: 'ADMINISTRATIVE' },
    { name: 'Recursos Humanos',            description: 'Departamento de Talento Humano y RRHH',         color: '#8B5CF6', order: 4,  familyCode: 'ADMINISTRATIVE' },
    { name: 'Seguridad y Salud Ocupacional', description: 'Departamento de SSO',                        color: '#14B8A6', order: 5,  familyCode: 'ADMINISTRATIVE' },
    // TECHNOLOGY
    { name: 'Tecnologías de la Información', description: 'Departamento de TI - Infraestructura y Sistemas', color: '#10B981', order: 6, familyCode: 'TECHNOLOGY' },
    { name: 'Soporte Técnico',             description: 'Departamento de Soporte y Mesa de Ayuda',       color: '#F59E0B', order: 7,  familyCode: 'TECHNOLOGY' },
    { name: 'Seguridad Informática',       description: 'Departamento de Seguridad de la Información',   color: '#DC2626', order: 8,  familyCode: 'TECHNOLOGY' },
    { name: 'Usuarios y Privilegios',      description: 'Departamento de Gestión de Usuarios y Accesos', color: '#6366F1', order: 9,  familyCode: 'TECHNOLOGY' },
    { name: 'Telefonía',                   description: 'Departamento de Telefonía y Comunicaciones',    color: '#0EA5E9', order: 10, familyCode: 'TECHNOLOGY' },
    // COMMERCIAL
    { name: 'Comercial',                   description: 'Departamento Comercial y Ventas',               color: '#F97316', order: 11, familyCode: 'COMMERCIAL' },
    { name: 'Marketing',                   description: 'Departamento de Marketing y Publicidad',        color: '#EC4899', order: 12, familyCode: 'COMMERCIAL' },
    // FIXED_ASSETS
    { name: 'Arquitectura',                description: 'Departamento de Arquitectura y Diseño',         color: '#6366F1', order: 13, familyCode: 'FIXED_ASSETS' },
    { name: 'Mantenimiento',               description: 'Departamento de Mantenimiento e Infraestructura', color: '#84CC16', order: 14, familyCode: 'FIXED_ASSETS' },
  ]
  const map = new Map<string, string>()
  for (const dept of departments) {
    const familyId = familyMap.get(dept.familyCode)!
    const d = await prisma.departments.upsert({
      where: { name: dept.name },
      update: { description: dept.description, color: dept.color, order: dept.order, familyId },
      create: { id: randomUUID(), name: dept.name, description: dept.description, color: dept.color, order: dept.order, familyId, createdAt: now, updatedAt: now },
    })
    map.set(dept.name, d.id)
  }
  console.log(`✅ ${departments.length} departamentos con familyId`)
  return map
}

// ============================================
// 5. ADMINISTRADOR
// ============================================

async function seedAdmin(deptAdminId: string): Promise<string> {
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.users.upsert({
    where: { email: 'internet.freecom@gmail.com' },
    update: {},
    create: {
      id: randomUUID(), email: 'internet.freecom@gmail.com', name: 'Administrador del Sistema',
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
  await prisma.user_settings.upsert({
    where: { userId: admin.id },
    update: {},
    create: { id: randomUUID(), userId: admin.id, theme: 'light', language: 'es', timezone: 'America/Guayaquil', updatedAt: now },
  })
  console.log('✅ Administrador (internet.freecom@gmail.com / admin123)')
  return admin.id
}

// ============================================
// 7. CONFIGURACIÓN DEL SITIO
// ============================================

async function seedSiteConfig() {
  const configs = [
    { key: 'site_name',          value: 'Sistema de Tickets Multi-Familia', description: 'Nombre del sitio web' },
    { key: 'company_name',       value: 'Mi Empresa',                       description: 'Nombre de la empresa' },
    { key: 'support_email',      value: 'internet.freecom@gmail.com',                description: 'Email de soporte técnico' },
    { key: 'max_file_size',      value: '10485760',                         description: 'Tamaño máximo de archivo en bytes (10MB)' },
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

// ============================================
// 8. POLÍTICAS DE SLA
// ============================================

async function seedSLAPolicies(familyMap: Map<string, string>) {
  const existing = await prisma.sla_policies.count()
  if (existing > 0) { console.log(`⏭️  SLA ya existe (${existing})`); return }

  const techFamilyId = familyMap.get('TECHNOLOGY')!

  // SLA globales (sin familia — fallback para todas las familias)
  const globalPolicies = [
    { name: 'Global - Urgente 24/7',    priority: 'URGENT', responseTimeHours: 2,  resolutionTimeHours: 8,  businessHoursOnly: false, businessHoursStart: '00:00:00', businessHoursEnd: '23:59:59', businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN' },
    { name: 'Global - Alta Prioridad',  priority: 'HIGH',   responseTimeHours: 8,  resolutionTimeHours: 48, businessHoursOnly: true,  businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00', businessDays: 'MON,TUE,WED,THU,FRI' },
    { name: 'Global - Prioridad Media', priority: 'MEDIUM', responseTimeHours: 24, resolutionTimeHours: 72, businessHoursOnly: true,  businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00', businessDays: 'MON,TUE,WED,THU,FRI' },
    { name: 'Global - Baja Prioridad',  priority: 'LOW',    responseTimeHours: 48, resolutionTimeHours: 120, businessHoursOnly: true, businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00', businessDays: 'MON,TUE,WED,THU,FRI' },
  ]
  for (const p of globalPolicies) {
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true } })
  }

  // SLA estrictos para TECHNOLOGY
  const techPolicies = [
    { name: 'TI - Urgente 24/7',    priority: 'URGENT', responseTimeHours: 1, resolutionTimeHours: 4,  businessHoursOnly: false, businessHoursStart: '00:00:00', businessHoursEnd: '23:59:59', businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN', familyId: techFamilyId },
    { name: 'TI - Alta Prioridad',  priority: 'HIGH',   responseTimeHours: 2, resolutionTimeHours: 8,  businessHoursOnly: true,  businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00', businessDays: 'MON,TUE,WED,THU,FRI', familyId: techFamilyId },
    { name: 'TI - Prioridad Media', priority: 'MEDIUM', responseTimeHours: 4, resolutionTimeHours: 24, businessHoursOnly: true,  businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00', businessDays: 'MON,TUE,WED,THU,FRI', familyId: techFamilyId },
    { name: 'TI - Baja Prioridad',  priority: 'LOW',    responseTimeHours: 8, resolutionTimeHours: 48, businessHoursOnly: true,  businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00', businessDays: 'MON,TUE,WED,THU,FRI', familyId: techFamilyId },
  ]
  for (const p of techPolicies) {
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true } })
  }
  console.log(`✅ ${globalPolicies.length} SLA globales + ${techPolicies.length} SLA para TECHNOLOGY`)
}

// ============================================
// 9. CATEGORÍAS (todas bajo TECHNOLOGY)
// ============================================

async function seedCategories(deptMap: Map<string, string>) {
  const deptInfraId    = deptMap.get('Tecnologías de la Información')!
  const deptTelefonia  = deptMap.get('Telefonía')!

  // ==================== INFRAESTRUCTURA TI ====================
  const fallaInfra = await upsertCategory({ name: 'Falla o Error', description: 'Incidentes y fallas en infraestructura', level: 1, parentId: null, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  const solicInfra = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes de infraestructura', level: 1, parentId: null, departmentId: deptInfraId, order: 2, color: '#3B82F6' })

  const networking = await upsertCategory({ name: 'Networking', description: 'Redes, conectividad, firewall, VPN', level: 2, parentId: fallaInfra.id, departmentId: deptInfraId, order: 1, color: '#10B981' })
  const energiaReg = await upsertCategory({ name: 'Energía Regulada', description: 'UPS, baterías, energía eléctrica', level: 2, parentId: fallaInfra.id, departmentId: deptInfraId, order: 2, color: '#F59E0B' })
  const office365  = await upsertCategory({ name: 'Gestión de Usuarios Office 365', description: 'Microsoft 365, Teams, licencias', level: 2, parentId: fallaInfra.id, departmentId: deptInfraId, order: 3, color: '#8B5CF6' })
  const impresion  = await upsertCategory({ name: 'Impresión', description: 'Impresoras, fotocopiadoras', level: 2, parentId: fallaInfra.id, departmentId: deptInfraId, order: 4, color: '#EC4899' })
  const solicInfraN2 = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes generales de infraestructura', level: 2, parentId: solicInfra.id, departmentId: deptInfraId, order: 1, color: '#3B82F6' })
  const energiaSolic = await upsertCategory({ name: 'Energía Regulada', description: 'Solicitudes de energía regulada', level: 2, parentId: solicInfra.id, departmentId: deptInfraId, order: 2, color: '#F59E0B' })

  // ==================== TELEFONÍA ====================
  const fallaTelefonia = await upsertCategory({ name: 'Falla o Error', description: 'Problemas con telefonía', level: 1, parentId: null, departmentId: deptTelefonia, order: 1, color: '#EF4444' })
  const solicTelefonia = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes de telefonía', level: 1, parentId: null, departmentId: deptTelefonia, order: 2, color: '#3B82F6' })
  const dañoBocina = await upsertCategory({ name: 'Daño de Bocina', description: 'Bocina dañada', level: 2, parentId: fallaTelefonia.id, departmentId: deptTelefonia, order: 1, color: '#EF4444' })
  const noFuncExt  = await upsertCategory({ name: 'No Funciona la Extensión', description: 'Extensión no funciona', level: 2, parentId: fallaTelefonia.id, departmentId: deptTelefonia, order: 2, color: '#EF4444' })
  const solicExt   = await upsertCategory({ name: 'Solicitud de Extensión', description: 'Nueva extensión', level: 2, parentId: solicTelefonia.id, departmentId: deptTelefonia, order: 1, color: '#3B82F6' })

  console.log('✅ Categorías (todas bajo familia TECHNOLOGY)')
}

// ============================================
// 10. TIPOS DE EQUIPO (con familyId directo)
// ============================================

async function seedEquipmentTypes(familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const types = [
    // TECHNOLOGY
    { code: 'LAPTOP',          name: 'Laptop',              icon: 'Laptop',       order: 1,  familyId: fam('TECHNOLOGY') },
    { code: 'DESKTOP',         name: 'Desktop',             icon: 'Monitor',      order: 2,  familyId: fam('TECHNOLOGY') },
    { code: 'MONITOR',         name: 'Monitor',             icon: 'Monitor',      order: 3,  familyId: fam('TECHNOLOGY') },
    { code: 'PRINTER',         name: 'Impresora',           icon: 'Printer',      order: 4,  familyId: fam('TECHNOLOGY') },
    { code: 'PHONE',           name: 'Teléfono',            icon: 'Phone',        order: 5,  familyId: fam('TECHNOLOGY') },
    { code: 'TABLET',          name: 'Tablet',              icon: 'Tablet',       order: 6,  familyId: fam('TECHNOLOGY') },
    { code: 'KEYBOARD',        name: 'Teclado',             icon: 'Keyboard',     order: 7,  familyId: fam('TECHNOLOGY') },
    { code: 'MOUSE',           name: 'Mouse',               icon: 'Mouse',        order: 8,  familyId: fam('TECHNOLOGY') },
    { code: 'HEADSET',         name: 'Audífonos',           icon: 'Headphones',   order: 9,  familyId: fam('TECHNOLOGY') },
    { code: 'WEBCAM',          name: 'Webcam',              icon: 'Camera',       order: 10, familyId: fam('TECHNOLOGY') },
    { code: 'DOCKING_STATION', name: 'Docking Station',     icon: 'Cpu',          order: 11, familyId: fam('TECHNOLOGY') },
    { code: 'UPS',             name: 'UPS',                 icon: 'Battery',      order: 12, familyId: fam('TECHNOLOGY') },
    { code: 'ROUTER',          name: 'Router',              icon: 'Router',       order: 13, familyId: fam('TECHNOLOGY') },
    { code: 'SWITCH',          name: 'Switch de Red',       icon: 'Wifi',         order: 14, familyId: fam('TECHNOLOGY') },
    { code: 'SERVER',          name: 'Servidor',            icon: 'Server',       order: 15, familyId: fam('TECHNOLOGY') },
    // FIXED_ASSETS
    { code: 'AC_UNIT',         name: 'Aire Acondicionado',  icon: 'Wind',         order: 20, familyId: fam('FIXED_ASSETS') },
    { code: 'GENERATOR',       name: 'Generador',           icon: 'Zap',          order: 21, familyId: fam('FIXED_ASSETS') },
    { code: 'ELEVATOR',        name: 'Ascensor',            icon: 'Building2',    order: 22, familyId: fam('FIXED_ASSETS') },
    { code: 'WATER_PUMP',      name: 'Bomba de Agua',       icon: 'Droplets',     order: 23, familyId: fam('FIXED_ASSETS') },
    { code: 'COMPRESSOR',      name: 'Compresor',           icon: 'Gauge',        order: 24, familyId: fam('FIXED_ASSETS') },
    // SECURITY
    { code: 'IP_CAMERA',       name: 'Cámara IP',           icon: 'Camera',       order: 30, familyId: fam('SECURITY') },
    { code: 'DVR_NVR',         name: 'DVR/NVR',             icon: 'HardDrive',    order: 31, familyId: fam('SECURITY') },
    { code: 'ACCESS_CONTROL',  name: 'Control de Acceso',   icon: 'Fingerprint',  order: 32, familyId: fam('SECURITY') },
    { code: 'ALARM_PANEL',     name: 'Panel de Alarma',     icon: 'AlertTriangle', order: 33, familyId: fam('SECURITY') },
    // MAINTENANCE
    { code: 'POWER_TOOL',      name: 'Herramienta Eléctrica', icon: 'Zap',        order: 40, familyId: fam('MAINTENANCE') },
    { code: 'HAND_TOOL',       name: 'Herramienta Manual',  icon: 'Wrench',       order: 41, familyId: fam('MAINTENANCE') },
    { code: 'MEASURING_TOOL',  name: 'Equipo de Medición',  icon: 'Ruler',        order: 42, familyId: fam('MAINTENANCE') },
    // SERVICES
    { code: 'CLEANING_MACHINE', name: 'Equipo de Limpieza', icon: 'Sparkles',     order: 50, familyId: fam('SERVICES') },
    { code: 'COFFEE_MACHINE',  name: 'Máquina de Café',     icon: 'Coffee',       order: 51, familyId: fam('SERVICES') },
    // COMMERCIAL
    { code: 'POS_TERMINAL',    name: 'Terminal POS',        icon: 'CreditCard',   order: 60, familyId: fam('COMMERCIAL') },
    { code: 'CASH_REGISTER',   name: 'Caja Registradora',   icon: 'DollarSign',   order: 61, familyId: fam('COMMERCIAL') },
    { code: 'BARCODE_READER',  name: 'Lector de Código de Barras', icon: 'Tag',   order: 62, familyId: fam('COMMERCIAL') },
    // General
    { code: 'OTHER',           name: 'Otro',                icon: 'Box',          order: 99, familyId: fam('TECHNOLOGY') },
  ]
  for (const t of types) {
    await prisma.equipment_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order, familyId: t.familyId },
      create: { id: randomUUID(), ...t, isActive: true },
    })
  }
  console.log(`✅ ${types.length} tipos de equipo con familyId`)
}

// ============================================
// 11. TIPOS DE LICENCIA (con familyId directo)
// ============================================

async function seedLicenseTypes(familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const types = [
    { code: 'WINDOWS',           name: 'Windows',                    icon: 'Monitor',      order: 1,  familyId: fam('TECHNOLOGY') },
    { code: 'OFFICE_365',        name: 'Office 365',                 icon: 'FileText',     order: 2,  familyId: fam('TECHNOLOGY') },
    { code: 'ANTIVIRUS',         name: 'Antivirus',                  icon: 'Shield',       order: 3,  familyId: fam('TECHNOLOGY') },
    { code: 'ADOBE',             name: 'Adobe',                      icon: 'Paintbrush',   order: 4,  familyId: fam('TECHNOLOGY') },
    { code: 'AUTOCAD',           name: 'AutoCAD',                    icon: 'Ruler',        order: 5,  familyId: fam('TECHNOLOGY') },
    { code: 'GOOGLE_WORKSPACE',  name: 'Google Workspace',           icon: 'Cloud',        order: 6,  familyId: fam('TECHNOLOGY') },
    { code: 'SAAS',              name: 'SaaS (Otro)',                 icon: 'Globe',        order: 7,  familyId: fam('TECHNOLOGY') },
    { code: 'SUBSCRIPTION',      name: 'Suscripción',                icon: 'RefreshCw',    order: 8,  familyId: fam('TECHNOLOGY') },
    { code: 'PERPETUAL',         name: 'Licencia Perpetua',          icon: 'Key',          order: 9,  familyId: fam('TECHNOLOGY') },
    { code: 'MAINTENANCE_CONTRACT', name: 'Contrato de Mantenimiento', icon: 'Wrench',     order: 20, familyId: fam('FIXED_ASSETS') },
    { code: 'SERVICE_CONTRACT',  name: 'Contrato de Servicio',       icon: 'ClipboardList', order: 21, familyId: fam('FIXED_ASSETS') },
    { code: 'ASSET_INSURANCE',   name: 'Seguro de Activos',          icon: 'ShieldCheck',  order: 22, familyId: fam('FIXED_ASSETS') },
    { code: 'CLEANING_CONTRACT', name: 'Contrato de Limpieza',       icon: 'Sparkles',     order: 30, familyId: fam('SERVICES') },
    { code: 'SECURITY_CONTRACT', name: 'Contrato de Seguridad',      icon: 'Shield',       order: 31, familyId: fam('SECURITY') },
    { code: 'POS_LICENSE',       name: 'Licencia Software POS',      icon: 'CreditCard',   order: 40, familyId: fam('COMMERCIAL') },
    { code: 'OTHER',             name: 'Otro',                       icon: 'Box',          order: 99, familyId: fam('TECHNOLOGY') },
  ]
  for (const t of types) {
    await prisma.license_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order, familyId: t.familyId },
      create: { id: randomUUID(), ...t, isActive: true },
    })
  }
  console.log(`✅ ${types.length} tipos de licencia con familyId`)
}

// ============================================
// 12. TIPOS DE CONSUMIBLE (con familyId directo)
// ============================================

async function seedConsumableTypes(familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const types = [
    { code: 'TONER',      name: 'Tóner',              icon: 'Printer',   order: 1,  familyId: fam('TECHNOLOGY') },
    { code: 'INK',        name: 'Tinta',              icon: 'Droplets',  order: 2,  familyId: fam('TECHNOLOGY') },
    { code: 'PAPER',      name: 'Papel',              icon: 'FileText',  order: 3,  familyId: fam('TECHNOLOGY') },
    { code: 'CABLE',      name: 'Cable',              icon: 'Cable',     order: 4,  familyId: fam('TECHNOLOGY') },
    { code: 'BATTERY',    name: 'Batería',            icon: 'Battery',   order: 5,  familyId: fam('TECHNOLOGY') },
    { code: 'STORAGE',    name: 'Almacenamiento',     icon: 'HardDrive', order: 6,  familyId: fam('TECHNOLOGY') },
    { code: 'SPARE_PART', name: 'Repuesto Mecánico',  icon: 'Wrench',    order: 10, familyId: fam('MAINTENANCE') },
    { code: 'LUBRICANT',  name: 'Lubricante',         icon: 'Droplets',  order: 11, familyId: fam('MAINTENANCE') },
    { code: 'FILTER',     name: 'Filtro',             icon: 'Settings',  order: 12, familyId: fam('MAINTENANCE') },
    { code: 'TOOL',       name: 'Herramienta',        icon: 'Wrench',    order: 13, familyId: fam('MAINTENANCE') },
    { code: 'CLEANING',   name: 'Producto de Limpieza', icon: 'Sparkles', order: 20, familyId: fam('SERVICES') },
    { code: 'HYGIENE',    name: 'Higiene',            icon: 'Sparkles',  order: 21, familyId: fam('SERVICES') },
    { code: 'SECURITY_BATTERY', name: 'Batería de Respaldo', icon: 'Battery', order: 30, familyId: fam('SECURITY') },
    { code: 'FERTILIZER', name: 'Fertilizante',       icon: 'Leaf',      order: 40, familyId: fam('GREEN_AREAS') },
    { code: 'PESTICIDE',  name: 'Pesticida',          icon: 'Leaf',      order: 41, familyId: fam('GREEN_AREAS') },
    { code: 'SEED',       name: 'Semilla',            icon: 'Flower2',   order: 42, familyId: fam('GREEN_AREAS') },
    { code: 'OTHER',      name: 'Otro',               icon: 'Box',       order: 99, familyId: fam('TECHNOLOGY') },
  ]
  for (const t of types) {
    await prisma.consumable_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order, familyId: t.familyId },
      create: { id: randomUUID(), ...t, isActive: true },
    })
  }
  console.log(`✅ ${types.length} tipos de consumible con familyId`)
}

// ============================================
// 13. UNIDADES DE MEDIDA
// ============================================

async function seedUnitsOfMeasure() {
  const units = [
    { code: 'UNIT',  name: 'Unidad',    symbol: 'ud',    order: 1 },
    { code: 'BOX',   name: 'Caja',      symbol: 'caja',  order: 2 },
    { code: 'PACK',  name: 'Paquete',   symbol: 'paq',   order: 3 },
    { code: 'REAM',  name: 'Resma',     symbol: 'resma', order: 4 },
    { code: 'METER', name: 'Metro',     symbol: 'm',     order: 5 },
    { code: 'LITER', name: 'Litro',     symbol: 'L',     order: 6 },
    { code: 'KG',    name: 'Kilogramo', symbol: 'kg',    order: 7 },
    { code: 'SET',   name: 'Juego',     symbol: 'juego', order: 8 },
  ]
  for (const u of units) {
    await prisma.units_of_measure.upsert({
      where: { code: u.code },
      update: { name: u.name, symbol: u.symbol, order: u.order },
      create: { id: randomUUID(), ...u, isActive: true },
    })
  }
  console.log(`✅ ${units.length} unidades de medida`)
}

// ============================================
// 14. CONFIGURACIONES DE INVENTARIO
// ============================================

async function seedInventorySettings() {
  const settings = [
    { key: 'inventory.act_expiration_days',          value: '7',    description: 'Días de expiración para actas' },
    { key: 'inventory.low_stock_alert_enabled',      value: 'true', description: 'Habilitar alertas de stock bajo' },
    { key: 'inventory.license_alert_enabled',        value: 'true', description: 'Habilitar alertas de vencimiento de licencias' },
    { key: 'inventory.license_alert_days_first',     value: '30',   description: 'Días antes para primera alerta de licencias' },
    { key: 'inventory.license_alert_days_second',    value: '7',    description: 'Días antes para segunda alerta de licencias' },
    { key: 'inventory.warranty_alert_days',          value: '30',   description: 'Días antes de vencimiento de garantía' },
    { key: 'inventory.mro_expiry_alert_enabled',     value: 'true', description: 'Habilita alertas de caducidad MRO' },
    { key: 'inventory.warranty_alert_enabled',       value: 'true', description: 'Habilita alertas de garantía de equipos' },
    { key: 'inventory.default_warehouse_id',         value: '',     description: 'ID de bodega por defecto' },
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

// ============================================
// 15. CONTADORES DE FOLIO
// ============================================

async function seedFolioCounters() {
  const types = ['ACT', 'DEV', 'BAJ']
  for (const type of types) {
    await prisma.folio_counters.upsert({
      where: { year_type: { year, type } },
      update: {},
      create: { id: randomUUID(), year, type, lastNumber: 0 },
    })
  }
  console.log(`✅ Contadores de folio (ACT, DEV, BAJ) para ${year}`)
}

// ============================================
// 16. CONTADORES DE CÓDIGO DE TICKET
// ============================================

async function seedTicketCodeCounters(familyMap: Map<string, string>) {
  const familiesWithSeq: Array<{ code: string; lastSequence: number }> = [
    { code: 'TECHNOLOGY',     lastSequence: 0 },
    { code: 'FIXED_ASSETS',   lastSequence: 0 },
    { code: 'ADMINISTRATIVE', lastSequence: 0 },
    { code: 'COMMERCIAL',     lastSequence: 0 },
    { code: 'SECURITY',       lastSequence: 0 },
    { code: 'MAINTENANCE',    lastSequence: 0 },
    { code: 'SERVICES',       lastSequence: 0 },
  ]
  for (const { code, lastSequence } of familiesWithSeq) {
    const familyId = familyMap.get(code)!
    await prisma.ticket_code_counters.upsert({
      where: { familyId_year: { familyId, year: 2026 } },
      update: { lastSequence },
      create: { id: randomUUID(), familyId, year: 2026, lastSequence },
    })
  }
  console.log(`✅ Contadores de código de ticket para 2026 (todos en 0)`)
}

// ============================================
// 17. BODEGA POR DEFECTO
// ============================================

async function seedDefaultWarehouse() {
  const existing = await prisma.warehouses.findFirst({ where: { name: 'Bodega Principal' } })
  if (!existing) {
    await prisma.warehouses.create({
      data: { id: randomUUID(), name: 'Bodega Principal', location: 'Instalaciones principales', isActive: true },
    })
    console.log('✅ Bodega Principal creada')
  } else {
    console.log('⏭️  Bodega Principal ya existe')
  }
}

// ============================================
// 18. LANDING PAGE
// ============================================

async function seedLandingPage() {
  const existingContent = await prisma.landing_page_content.count()
  if (existingContent === 0) {
    await prisma.landing_page_content.create({
      data: {
        id: randomUUID(),
        heroTitle: 'Soporte Multi-Área Profesional',
        heroSubtitle: 'Gestión de tickets para todas las áreas de tu organización',
        heroCtaPrimary: 'Crear Ticket de Soporte',
        heroCtaPrimaryUrl: '/login',
        heroCtaSecondary: 'Ver Servicios',
        heroCtaSecondaryUrl: '#servicios',
        servicesTitle: 'Nuestros Servicios',
        servicesSubtitle: 'Soporte técnico integral para todas las áreas',
        servicesEnabled: true,
        companyName: 'Sistema de Tickets Multi-Familia',
        companyTagline: 'Soporte profesional para toda la organización',
        footerText: `© ${year} Sistema de Tickets. Todos los derechos reservados.`,
        metaTitle: 'Sistema de Tickets Multi-Familia',
        metaDescription: 'Sistema profesional de gestión de tickets multi-área',
        showStats: false, showTestimonials: false, showFaq: false,
      },
    })
  }
  const services = [
    { id: 'service-1', order: 1, enabled: true, icon: 'Wrench',  iconColor: 'blue',   title: 'Soporte TI',          description: 'Atención de incidencias tecnológicas con seguimiento en tiempo real.' },
    { id: 'service-2', order: 2, enabled: true, icon: 'Server',  iconColor: 'green',  title: 'Gestión de Inventario', description: 'Control de equipos, asignaciones y actas de entrega digitales.' },
    { id: 'service-3', order: 3, enabled: true, icon: 'Building2', iconColor: 'orange', title: 'Infraestructura',    description: 'Soporte para activos fijos, mantenimiento e infraestructura.' },
  ]
  for (const s of services) {
    await prisma.landing_page_services.upsert({
      where: { id: s.id },
      update: { title: s.title, description: s.description },
      create: s,
    })
  }
  console.log('✅ Landing page')
}

// ============================================
// 19. ARTÍCULOS DE BASE DE CONOCIMIENTOS
// ============================================

async function seedKnowledgeArticles(
  familyMap: Map<string, string>,
  deptMap: Map<string, string>,
  adminId: string
) {
  const articles = [
    {
      familyCode: 'TECHNOLOGY',
      title: 'Cómo restablecer tu contraseña de Microsoft 365',
      content: 'Para restablecer tu contraseña de M365: 1) Ve a portal.office.com 2) Haz clic en "¿Olvidaste tu contraseña?" 3) Sigue las instrucciones de verificación.',
      summary: 'Guía paso a paso para restablecer contraseña M365',
      tags: ['m365', 'contraseña', 'acceso'],
    },
    {
      familyCode: 'TECHNOLOGY',
      title: 'Solución a problemas de conexión VPN',
      content: 'Si tienes problemas con la VPN: 1) Verifica que el cliente VPN esté actualizado 2) Comprueba tus credenciales 3) Reinicia el servicio VPN en tu equipo.',
      summary: 'Pasos para resolver problemas comunes de VPN',
      tags: ['vpn', 'conexión', 'red'],
    },
    {
      familyCode: 'FIXED_ASSETS',
      title: 'Procedimiento de solicitud de mantenimiento de equipos',
      content: 'Para solicitar mantenimiento: 1) Crea un ticket en la familia Infraestructura 2) Describe el equipo y el problema 3) Adjunta fotos si es posible 4) El técnico coordinará la visita.',
      summary: 'Cómo solicitar mantenimiento de activos fijos',
      tags: ['mantenimiento', 'infraestructura', 'activos'],
    },
    {
      familyCode: 'ADMINISTRATIVE',
      title: 'Proceso de solicitud de reportes administrativos',
      content: 'Para solicitar reportes: 1) Crea un ticket en la familia Administrativa 2) Especifica el tipo de reporte y período 3) Indica el formato requerido (Excel, PDF) 4) El área procesará en 48h hábiles.',
      summary: 'Cómo solicitar reportes al área administrativa',
      tags: ['reportes', 'administrativo', 'documentos'],
    },
    {
      familyCode: 'MAINTENANCE',
      title: 'Guía de solicitud de mantenimiento preventivo',
      content: 'Para solicitar mantenimiento preventivo: 1) Identifica el equipo o instalación 2) Crea un ticket indicando el tipo de mantenimiento 3) Adjunta el historial de mantenimiento si está disponible.',
      summary: 'Cómo solicitar mantenimiento preventivo',
      tags: ['mantenimiento', 'preventivo', 'equipos'],
    },
    {
      familyCode: 'SERVICES',
      title: 'Solicitud de servicios generales',
      content: 'Para solicitar servicios generales: 1) Crea un ticket en la familia Servicios 2) Describe el servicio requerido 3) Indica la ubicación y urgencia 4) El equipo coordinará la atención.',
      summary: 'Cómo solicitar servicios generales',
      tags: ['servicios', 'limpieza', 'operaciones'],
    },
    {
      familyCode: 'SECURITY',
      title: 'Reporte de incidentes de seguridad',
      content: 'Para reportar un incidente de seguridad: 1) Crea un ticket urgente en la familia Seguridad 2) Describe el incidente con detalle 3) Indica la ubicación y hora del incidente 4) No manipules evidencia.',
      summary: 'Cómo reportar incidentes de seguridad',
      tags: ['seguridad', 'incidente', 'reporte'],
    },
    {
      familyCode: 'COMMERCIAL',
      title: 'Solicitud de materiales de marketing',
      content: 'Para solicitar materiales de marketing: 1) Crea un ticket en la familia Comercial 2) Especifica el tipo de material y cantidad 3) Indica la fecha de necesidad 4) El área de marketing procesará la solicitud.',
      summary: 'Cómo solicitar materiales comerciales y de marketing',
      tags: ['marketing', 'comercial', 'materiales'],
    },
  ]

  for (const a of articles) {
    const familyId = familyMap.get(a.familyCode)!
    // Buscar una categoría de esa familia; si no hay, usar cualquier categoría de TECHNOLOGY como fallback
    let category = await prisma.categories.findFirst({
      where: { departments: { familyId }, level: 1 },
    })
    if (!category) {
      category = await prisma.categories.findFirst({
        where: { departments: { familyId: familyMap.get('TECHNOLOGY') }, level: 1 },
      })
    }
    if (!category) continue

    const existing = await prisma.knowledge_articles.findFirst({ where: { title: a.title } })
    if (!existing) {
      await prisma.knowledge_articles.create({
        data: {
          id: randomUUID(), title: a.title, content: a.content, summary: a.summary,
          categoryId: category.id, familyId, authorId: adminId,
          tags: a.tags, isPublished: true,
        },
      })
    }
  }
  console.log(`✅ ${articles.length} artículos de base de conocimientos (1 por familia con ticketsEnabled=true)`)
}

// ============================================
// EJECUTAR
// ============================================

main()
  .catch(e => { console.error('❌ Error durante el seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
