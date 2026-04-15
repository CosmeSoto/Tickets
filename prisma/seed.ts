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

  // 9b. CATEGORÍAS OTRAS FAMILIAS (Mantenimiento, Seguridad, Servicios, etc.)
  await seedCategoriesOtherFamilies(deptMap)

  // 10. TIPOS DE EQUIPO (con familyId directo)
  await seedEquipmentTypes(familyMap)

  // 11. TIPOS DE LICENCIA (con familyId directo)
  await seedLicenseTypes(familyMap)

  // 12. TIPOS DE CONSUMIBLE (con familyId directo)
  await seedConsumableTypes(familyMap)

  // 13. UNIDADES DE MEDIDA
  await seedUnitsOfMeasure()

  // 13b. TIPOS DE PROVEEDOR
  await seedSupplierTypes(familyMap)

  // 13c. MIGRAR suppliers existentes: type enum → typeId
  await migrateSupplierTypes()

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

  // 19. ARTÍCULOS DE BASE DE CONOCIMIENTOS — omitido (sin datos de ejemplo)

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
  // allowedFromFamilies vacío = acepta de TODAS las familias
  const enabledFamilies = [
    { code: 'TECHNOLOGY',     prefix: 'TI',   isDefault: true,  allowedFromFamilies: [] },
    { code: 'FIXED_ASSETS',   prefix: 'INF',  isDefault: false, allowedFromFamilies: [] },
    { code: 'MAINTENANCE',    prefix: 'MNT',  isDefault: false, allowedFromFamilies: [] },
    { code: 'SERVICES',       prefix: 'SRV',  isDefault: false, allowedFromFamilies: [] },
    { code: 'SECURITY',       prefix: 'SEG',  isDefault: false, allowedFromFamilies: [] },
    { code: 'ADMINISTRATIVE', prefix: 'ADM',  isDefault: false, allowedFromFamilies: [] },
    { code: 'COMMERCIAL',     prefix: 'COM',  isDefault: false, allowedFromFamilies: [] },
  ]
  // GREEN_AREAS: ticketsEnabled = false
  const disabledFamilies = ['GREEN_AREAS']

  for (const f of enabledFamilies) {
    const familyId = familyMap.get(f.code)!
    await prisma.ticket_family_config.upsert({
      where: { familyId },
      update: { codePrefix: f.prefix, isDefault: f.isDefault, ticketsEnabled: true, allowedFromFamilies: f.allowedFromFamilies },
      create: {
        id: randomUUID(), familyId,
        ticketsEnabled: true, codePrefix: f.prefix, isDefault: f.isDefault,
        allowedFromFamilies: f.allowedFromFamilies,
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
        allowedFromFamilies: [],
        autoAssignRespectsFamilies: true,
        businessHoursStart: '08:00:00', businessHoursEnd: '17:00:00',
        businessDays: 'MON,TUE,WED,THU,FRI',
      },
    })
  }
  console.log('✅ Configuraciones de tickets por familia (allowedFromFamilies vacío = todas)')
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
    // MAINTENANCE
    { name: 'Mantenimiento Civil',         description: 'Mantenimiento de obras civiles e infraestructura', color: '#10B981', order: 15, familyCode: 'MAINTENANCE' },
    { name: 'Mantenimiento Eléctrico',     description: 'Mantenimiento de instalaciones eléctricas',      color: '#F59E0B', order: 16, familyCode: 'MAINTENANCE' },
    { name: 'Mantenimiento Mecánico',      description: 'Mantenimiento de equipos mecánicos',             color: '#EF4444', order: 17, familyCode: 'MAINTENANCE' },
    // SECURITY
    { name: 'Seguridad Física',            description: 'Seguridad física y vigilancia',                  color: '#EF4444', order: 18, familyCode: 'SECURITY' },
    { name: 'CCTV y Control de Acceso',    description: 'Cámaras, control de acceso y alarmas',           color: '#DC2626', order: 19, familyCode: 'SECURITY' },
    // SERVICES
    { name: 'Limpieza',                    description: 'Servicios de limpieza y aseo',                   color: '#06B6D4', order: 20, familyCode: 'SERVICES' },
    { name: 'Mensajería',                  description: 'Servicios de mensajería y correspondencia',      color: '#8B5CF6', order: 21, familyCode: 'SERVICES' },
    // GREEN_AREAS
    { name: 'Áreas Verdes',                description: 'Mantenimiento de jardines y áreas verdes',       color: '#22C55E', order: 22, familyCode: 'GREEN_AREAS' },
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
    update: { isSuperAdmin: true },
    create: {
      id: randomUUID(), email: 'internet.freecom@gmail.com', name: 'Administrador del Sistema',
      passwordHash: adminPassword, role: UserRole.ADMIN, departmentId: deptAdminId,
      phone: '+593999999999', isActive: true, isEmailVerified: true, isSuperAdmin: true,
      createdAt: now, updatedAt: now,
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
  const deptSoporteId  = deptMap.get('Soporte Técnico')!
  const deptSeguridadId = deptMap.get('Seguridad Informática')!
  const deptUsuariosId = deptMap.get('Usuarios y Privilegios')!
  const deptTelefoniaId = deptMap.get('Telefonía')!

  // ==================== INFRAESTRUCTURA ====================
  const fallaErrorInfra = await upsertCategory({ name: 'Falla o Error', description: 'Incidentes y fallas en infraestructura', level: 1, parentId: null, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  const solicitudRequerimientoInfra = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes y requerimientos de infraestructura', level: 1, parentId: null, departmentId: deptInfraId, order: 2, color: '#3B82F6' })

  const networking = await upsertCategory({ name: 'Networking', description: 'Redes, conectividad, comunicaciones, firewall, VPN, central telefónica', level: 2, parentId: fallaErrorInfra.id, departmentId: deptInfraId, order: 1, color: '#10B981' })
  const energiaRegulada = await upsertCategory({ name: 'Energía Regulada', description: 'UPS, baterías, energía eléctrica, estabilizadores', level: 2, parentId: fallaErrorInfra.id, departmentId: deptInfraId, order: 2, color: '#F59E0B' })
  const gestionOffice365 = await upsertCategory({ name: 'Gestión de Usuarios Office 365', description: 'Plataforma Microsoft 365, Teams, licencias, cuentas', level: 2, parentId: fallaErrorInfra.id, departmentId: deptInfraId, order: 3, color: '#8B5CF6' })
  const impresion = await upsertCategory({ name: 'Impresión', description: 'Impresoras, fotocopiadoras, problemas de impresión', level: 2, parentId: fallaErrorInfra.id, departmentId: deptInfraId, order: 4, color: '#EC4899' })

  const solicitudRequerimientoN2Infra = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes generales de infraestructura', level: 2, parentId: solicitudRequerimientoInfra.id, departmentId: deptInfraId, order: 1, color: '#3B82F6' })
  const energiaReguladaSolicitud = await upsertCategory({ name: 'Energía Regulada', description: 'Solicitudes de energía regulada, UPS, baterías', level: 2, parentId: solicitudRequerimientoInfra.id, departmentId: deptInfraId, order: 2, color: '#F59E0B' })

  // N3 - Networking
  await upsertCategory({ name: 'Pérdida de Conexión', description: 'Sin conexión de red, caída de conectividad', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Daño de Equipos Comunicaciones', description: 'Equipos de red dañados, switch, router', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Pérdida de Rutas Comunicación', description: 'Rutas de red perdidas, routing', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Pérdida de Comunicación Inalámbrica', description: 'WiFi caído, señal inalámbrica', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Firewall', description: 'Problemas con firewall, bloqueo de puertos', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 5, color: '#EF4444' })
  await upsertCategory({ name: 'Central Telefónica', description: 'Problemas con PBX, central telefónica', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 6, color: '#EF4444' })
  await upsertCategory({ name: 'VPN', description: 'Problemas con VPN, túnel VPN caído', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 7, color: '#EF4444' })

  // N3 - Solicitudes Infraestructura
  await upsertCategory({ name: 'Creación de SSID', description: 'Solicitud de nueva red WiFi, SSID', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'VPN', description: 'Solicitud de acceso VPN, configuración VPN', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Fortinet', description: 'Solicitud relacionada con Fortinet, firewall Fortinet', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 3, color: '#3B82F6' })
  await upsertCategory({ name: 'Reportes', description: 'Solicitud de reportes de infraestructura', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 4, color: '#3B82F6' })
  await upsertCategory({ name: 'Creación de Cuenta', description: 'Solicitud de creación de cuenta de usuario', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 5, color: '#3B82F6' })
  await upsertCategory({ name: 'Reseteo Contraseña', description: 'Solicitud de reseteo de contraseña', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 6, color: '#3B82F6' })

  // N3 - Energía Regulada (Falla)
  await upsertCategory({ name: 'En Batería', description: 'UPS funcionando en batería, sin corriente', level: 3, parentId: energiaRegulada.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'No Enciende', description: 'Equipo de energía no enciende', level: 3, parentId: energiaRegulada.id, departmentId: deptInfraId, order: 2, color: '#EF4444' })

  // N3 - Energía Regulada (Solicitudes)
  await upsertCategory({ name: 'Nuevos Equipos', description: 'Solicitud de nuevos equipos de energía', level: 3, parentId: energiaReguladaSolicitud.id, departmentId: deptInfraId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Mantenimiento', description: 'Solicitud de mantenimiento de equipos', level: 3, parentId: energiaReguladaSolicitud.id, departmentId: deptInfraId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Reemplazo de Partes', description: 'Solicitud de reemplazo de componentes', level: 3, parentId: energiaReguladaSolicitud.id, departmentId: deptInfraId, order: 3, color: '#3B82F6' })

  // N3 - Office 365 (Falla)
  await upsertCategory({ name: 'Plataforma Intermitente', description: 'Office 365 intermitente, inestable', level: 3, parentId: gestionOffice365.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })

  // N3 - Solicitud N2 — adicionales faltantes
  await upsertCategory({ name: 'Asignación de Licencia', description: 'Solicitud de asignación de licencia de software', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 7, color: '#3B82F6' })
  await upsertCategory({ name: 'Teams', description: 'Solicitud relacionada con Microsoft Teams', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 8, color: '#3B82F6' })

  // N3 - Impresión (completo según hoja de cálculo)
  await upsertCategory({ name: 'Atasco de Papel', description: 'Impresora atascada, papel trabado', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Baja Calidad de Imagen', description: 'Impresión con baja calidad, borrosa', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Cable de Impresora Dañado', description: 'Cable de red o USB dañado', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Impresora Bloqueada', description: 'Impresora bloqueada, cola de impresión', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Impresora sin Conexión/Red', description: 'Impresora sin conexión de red', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 5, color: '#EF4444' })
  await upsertCategory({ name: 'La Impresora no Digitaliza/Escanea', description: 'Escáner no funciona', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 6, color: '#EF4444' })
  await upsertCategory({ name: 'La Impresora no Enciende', description: 'Impresora no enciende', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 7, color: '#EF4444' })
  await upsertCategory({ name: 'La Impresora no Fotocopia', description: 'Función de fotocopiado no funciona', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 8, color: '#EF4444' })
  await upsertCategory({ name: 'La Impresora no Imprime', description: 'Impresora no imprime', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 9, color: '#EF4444' })
  await upsertCategory({ name: 'Líneas al Escanear', description: 'Aparecen líneas al escanear', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 10, color: '#EF4444' })
  await upsertCategory({ name: 'Líneas al Fotocopiar', description: 'Aparecen líneas al fotocopiar', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 11, color: '#EF4444' })
  await upsertCategory({ name: 'Líneas al Imprimir', description: 'Aparecen líneas al imprimir', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 12, color: '#EF4444' })
  await upsertCategory({ name: 'No Imprime Stickers', description: 'Impresora de etiquetas no imprime stickers', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 13, color: '#EF4444' })
  await upsertCategory({ name: 'Ruido al Imprimir', description: 'Impresora hace ruido anormal al imprimir', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 14, color: '#EF4444' })

  // ==================== SOPORTE TÉCNICO ====================
  const fallaErrorSoporte = await upsertCategory({ name: 'Falla o Error', description: 'Incidentes y fallas en soporte técnico', level: 1, parentId: null, departmentId: deptSoporteId, order: 1, color: '#EF4444' })
  const solicitudRequerimientoSoporte = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes y requerimientos de soporte técnico', level: 1, parentId: null, departmentId: deptSoporteId, order: 2, color: '#3B82F6' })

  const equipos = await upsertCategory({ name: 'Equipos', description: 'Computadoras, laptops, equipos de cómputo', level: 2, parentId: fallaErrorSoporte.id, departmentId: deptSoporteId, order: 1, color: '#10B981' })
  const solicitudRequerimientoN2Soporte = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes generales de soporte', level: 2, parentId: solicitudRequerimientoSoporte.id, departmentId: deptSoporteId, order: 1, color: '#3B82F6' })
  const suministros = await upsertCategory({ name: 'Suministros', description: 'Solicitudes de suministros y materiales', level: 2, parentId: solicitudRequerimientoSoporte.id, departmentId: deptSoporteId, order: 2, color: '#F59E0B' })

  await upsertCategory({ name: 'Verificación de Partes', description: 'Verificación de componentes, hardware', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Preparación Equipos', description: 'Preparación de equipos nuevos', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Revisión Equipos', description: 'Revisión técnica de equipos', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Instalar Software Base', description: 'Instalación de sistema operativo y software base', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Reparación de Equipos', description: 'Reparación de hardware, componentes', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 5, color: '#EF4444' })

  await upsertCategory({ name: 'Renovación de Equipo', description: 'Solicitud de renovación de equipo', level: 3, parentId: solicitudRequerimientoN2Soporte.id, departmentId: deptSoporteId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Adquisición Equipos', description: 'Solicitud de compra de equipos', level: 3, parentId: solicitudRequerimientoN2Soporte.id, departmentId: deptSoporteId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Adquisición de Impresoras', description: 'Solicitud de compra de impresoras', level: 3, parentId: solicitudRequerimientoN2Soporte.id, departmentId: deptSoporteId, order: 3, color: '#3B82F6' })

  await upsertCategory({ name: 'Verificación de Partes', description: 'Verificación de partes y suministros', level: 3, parentId: suministros.id, departmentId: deptSoporteId, order: 1, color: '#F59E0B' })

  // ==================== SEGURIDAD DE LA INFORMACIÓN ====================
  const incidentes = await upsertCategory({ name: 'Incidentes', description: 'Incidentes de seguridad de la información', level: 1, parentId: null, departmentId: deptSeguridadId, order: 1, color: '#EF4444' })
  const requerimientosSeguridad = await upsertCategory({ name: 'Requerimientos', description: 'Requerimientos de seguridad de la información', level: 1, parentId: null, departmentId: deptSeguridadId, order: 2, color: '#3B82F6' })

  await upsertCategory({ name: 'Divulgación no Autorizada de Información Confidencial', description: 'Fuga de información, datos confidenciales', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Sensibilización y Entrenamiento a Usuarios', description: 'Capacitación en seguridad', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Sucesivos Intentos Fallidos de Login', description: 'Múltiples intentos de acceso fallidos', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Ataques Informáticos', description: 'Cyberataques, hacking, malware', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Accesos o Intentos no Autorizados', description: 'Acceso no autorizado a sistemas', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 5, color: '#EF4444' })

  await upsertCategory({ name: 'Informes de Validación de Alta de Cuentas Usuarias', description: 'Validación de nuevas cuentas', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Informes sobre Validación de Baja de Cuentas Usuarias', description: 'Validación de cuentas eliminadas', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Informe sobre Validación de Modificación de Cuentas Usuarias', description: 'Validación de cambios en cuentas', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 3, color: '#3B82F6' })
  await upsertCategory({ name: 'Definición de Políticas de Seguridad de la Información', description: 'Creación de políticas de seguridad', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 4, color: '#3B82F6' })
  await upsertCategory({ name: 'Aprobación del Servicio VPN', description: 'Aprobación de acceso VPN', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 5, color: '#3B82F6' })

  // ==================== USUARIOS Y PRIVILEGIOS ====================
  const fallaErrorUsuarios = await upsertCategory({ name: 'Falla o Error', description: 'Problemas con usuarios y privilegios', level: 1, parentId: null, departmentId: deptUsuariosId, order: 1, color: '#EF4444' })
  const solicitudRequerimientoUsuarios = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes de usuarios y privilegios', level: 1, parentId: null, departmentId: deptUsuariosId, order: 2, color: '#3B82F6' })

  const m365Fallas = await upsertCategory({ name: 'Microsoft 365', description: 'Problemas con Office 365, Microsoft 365', level: 2, parentId: fallaErrorUsuarios.id, departmentId: deptUsuariosId, order: 1, color: '#8B5CF6' })
  const m365Solicitudes = await upsertCategory({ name: 'Microsoft 365', description: 'Solicitudes relacionadas con M365', level: 2, parentId: solicitudRequerimientoUsuarios.id, departmentId: deptUsuariosId, order: 1, color: '#8B5CF6' })
  const vpnUsuarios = await upsertCategory({ name: 'VPN', description: 'Solicitudes de VPN, acceso remoto', level: 2, parentId: solicitudRequerimientoUsuarios.id, departmentId: deptUsuariosId, order: 2, color: '#10B981' })

  await upsertCategory({ name: 'Error al Iniciar Sesión en M365', description: 'No puede iniciar sesión en Microsoft 365', level: 3, parentId: m365Fallas.id, departmentId: deptUsuariosId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Servicio no Disponible en M365', description: 'Servicio M365 caído, no disponible', level: 3, parentId: m365Fallas.id, departmentId: deptUsuariosId, order: 2, color: '#EF4444' })

  await upsertCategory({ name: 'Cambio de Contraseña Correo', description: 'Solicitud de cambio de contraseña de correo', level: 3, parentId: m365Solicitudes.id, departmentId: deptUsuariosId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Creación de Usuario M365', description: 'Solicitud de nuevo usuario en M365', level: 3, parentId: m365Solicitudes.id, departmentId: deptUsuariosId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Desactivación de Usuarios en M365', description: 'Solicitud de desactivar usuario M365', level: 3, parentId: m365Solicitudes.id, departmentId: deptUsuariosId, order: 3, color: '#3B82F6' })

  await upsertCategory({ name: 'Creación de Usuario VPN', description: 'Solicitud de nuevo usuario VPN', level: 3, parentId: vpnUsuarios.id, departmentId: deptUsuariosId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Baja de Usuario VPN', description: 'Solicitud de eliminar usuario VPN', level: 3, parentId: vpnUsuarios.id, departmentId: deptUsuariosId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Modificación Perfil y Privilegios Acceso VPN', description: 'Cambio de permisos VPN', level: 3, parentId: vpnUsuarios.id, departmentId: deptUsuariosId, order: 3, color: '#3B82F6' })

  // ==================== TELEFONÍA ====================
  const fallaErrorTelefonia = await upsertCategory({ name: 'Falla o Error', description: 'Problemas con telefonía', level: 1, parentId: null, departmentId: deptTelefoniaId, order: 1, color: '#EF4444' })
  const solicitudRequerimientoTelefonia = await upsertCategory({ name: 'Solicitud o Requerimiento', description: 'Solicitudes de telefonía', level: 1, parentId: null, departmentId: deptTelefoniaId, order: 2, color: '#3B82F6' })

  await upsertCategory({ name: 'Daño de Bocina', description: 'Bocina del teléfono dañada', level: 2, parentId: fallaErrorTelefonia.id, departmentId: deptTelefoniaId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Daño de Extensión', description: 'Extensión telefónica dañada', level: 2, parentId: fallaErrorTelefonia.id, departmentId: deptTelefoniaId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'No Funciona la Extensión', description: 'Extensión no funciona', level: 2, parentId: fallaErrorTelefonia.id, departmentId: deptTelefoniaId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Problemas con Llamadas Entrantes y Salientes', description: 'Problemas con llamadas', level: 2, parentId: fallaErrorTelefonia.id, departmentId: deptTelefoniaId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Teléfono sin Red', description: 'Teléfono sin conexión de red', level: 2, parentId: fallaErrorTelefonia.id, departmentId: deptTelefoniaId, order: 5, color: '#EF4444' })

  await upsertCategory({ name: 'Cambio de Extensión', description: 'Solicitud de cambio de extensión', level: 2, parentId: solicitudRequerimientoTelefonia.id, departmentId: deptTelefoniaId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Solicitud de Extensión', description: 'Solicitud de nueva extensión', level: 2, parentId: solicitudRequerimientoTelefonia.id, departmentId: deptTelefoniaId, order: 2, color: '#3B82F6' })

  console.log('✅ Categorías (5 departamentos con jerarquía N1 → N2 → N3)')
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
// EJECUTAR
// ============================================

main()
  .catch(e => { console.error('❌ Error durante el seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })

// ============================================
// 9b. CATEGORÍAS OTRAS FAMILIAS
// ============================================

async function seedCategoriesOtherFamilies(deptMap: Map<string, string>) {
  // Solo crear si el departamento existe en el mapa
  const get = (name: string) => deptMap.get(name)

  // ── MANTENIMIENTO CIVIL ──────────────────────────────────────────────────
  const deptCivil = get('Mantenimiento Civil')
  if (deptCivil) {
    const fallasCivil = await upsertCategory({ name: 'Falla o Daño', description: 'Daños en infraestructura civil', level: 1, parentId: null, departmentId: deptCivil, order: 1, color: '#EF4444' })
    const solicCivil  = await upsertCategory({ name: 'Solicitud de Trabajo', description: 'Solicitudes de trabajos civiles', level: 1, parentId: null, departmentId: deptCivil, order: 2, color: '#3B82F6' })
    await upsertCategory({ name: 'Filtraciones / Goteras', description: 'Filtraciones de agua, goteras en techo', level: 2, parentId: fallasCivil.id, departmentId: deptCivil, order: 1, color: '#EF4444' })
    await upsertCategory({ name: 'Daño en Paredes / Pisos', description: 'Grietas, fisuras, daños en superficies', level: 2, parentId: fallasCivil.id, departmentId: deptCivil, order: 2, color: '#EF4444' })
    await upsertCategory({ name: 'Puertas / Ventanas', description: 'Daños en puertas, ventanas, cerraduras', level: 2, parentId: fallasCivil.id, departmentId: deptCivil, order: 3, color: '#EF4444' })
    await upsertCategory({ name: 'Plomería / Sanitarios', description: 'Problemas de plomería, sanitarios, tuberías', level: 2, parentId: fallasCivil.id, departmentId: deptCivil, order: 4, color: '#EF4444' })
    await upsertCategory({ name: 'Remodelación / Adecuación', description: 'Trabajos de remodelación o adecuación de espacios', level: 2, parentId: solicCivil.id, departmentId: deptCivil, order: 1, color: '#3B82F6' })
    await upsertCategory({ name: 'Pintura', description: 'Trabajos de pintura interior o exterior', level: 2, parentId: solicCivil.id, departmentId: deptCivil, order: 2, color: '#3B82F6' })
    await upsertCategory({ name: 'Instalación de Mobiliario', description: 'Instalación de muebles, estantes, divisiones', level: 2, parentId: solicCivil.id, departmentId: deptCivil, order: 3, color: '#3B82F6' })
  }

  // ── MANTENIMIENTO ELÉCTRICO ──────────────────────────────────────────────
  const deptElec = get('Mantenimiento Eléctrico')
  if (deptElec) {
    const fallasElec = await upsertCategory({ name: 'Falla Eléctrica', description: 'Fallas en instalaciones eléctricas', level: 1, parentId: null, departmentId: deptElec, order: 1, color: '#EF4444' })
    const solicElec  = await upsertCategory({ name: 'Solicitud Eléctrica', description: 'Solicitudes de trabajos eléctricos', level: 1, parentId: null, departmentId: deptElec, order: 2, color: '#3B82F6' })
    await upsertCategory({ name: 'Sin Energía / Corte', description: 'Corte de energía, sin suministro eléctrico', level: 2, parentId: fallasElec.id, departmentId: deptElec, order: 1, color: '#EF4444' })
    await upsertCategory({ name: 'Cortocircuito / Sobrecarga', description: 'Cortocircuito, sobrecarga eléctrica', level: 2, parentId: fallasElec.id, departmentId: deptElec, order: 2, color: '#EF4444' })
    await upsertCategory({ name: 'Luminaria Dañada', description: 'Lámparas, focos, luminarias dañadas', level: 2, parentId: fallasElec.id, departmentId: deptElec, order: 3, color: '#EF4444' })
    await upsertCategory({ name: 'Tomacorriente / Interruptor', description: 'Tomacorrientes o interruptores dañados', level: 2, parentId: fallasElec.id, departmentId: deptElec, order: 4, color: '#EF4444' })
    await upsertCategory({ name: 'Instalación Eléctrica Nueva', description: 'Solicitud de nueva instalación eléctrica', level: 2, parentId: solicElec.id, departmentId: deptElec, order: 1, color: '#3B82F6' })
    await upsertCategory({ name: 'Cambio de Luminaria', description: 'Solicitud de cambio o mejora de luminarias', level: 2, parentId: solicElec.id, departmentId: deptElec, order: 2, color: '#3B82F6' })
  }

  // ── SEGURIDAD FÍSICA ─────────────────────────────────────────────────────
  const deptSeg = get('Seguridad Física')
  if (deptSeg) {
    const incSeg  = await upsertCategory({ name: 'Incidente de Seguridad', description: 'Incidentes de seguridad física', level: 1, parentId: null, departmentId: deptSeg, order: 1, color: '#EF4444' })
    const solicSeg = await upsertCategory({ name: 'Solicitud de Seguridad', description: 'Solicitudes al área de seguridad', level: 1, parentId: null, departmentId: deptSeg, order: 2, color: '#3B82F6' })
    await upsertCategory({ name: 'Acceso No Autorizado', description: 'Persona no autorizada en área restringida', level: 2, parentId: incSeg.id, departmentId: deptSeg, order: 1, color: '#EF4444' })
    await upsertCategory({ name: 'Robo / Hurto', description: 'Robo o hurto de bienes', level: 2, parentId: incSeg.id, departmentId: deptSeg, order: 2, color: '#EF4444' })
    await upsertCategory({ name: 'Vandalismo', description: 'Daños intencionales a la propiedad', level: 2, parentId: incSeg.id, departmentId: deptSeg, order: 3, color: '#EF4444' })
    await upsertCategory({ name: 'Acceso a Área Restringida', description: 'Solicitud de acceso a área restringida', level: 2, parentId: solicSeg.id, departmentId: deptSeg, order: 1, color: '#3B82F6' })
    await upsertCategory({ name: 'Credencial / Carnet', description: 'Solicitud de credencial o carnet de acceso', level: 2, parentId: solicSeg.id, departmentId: deptSeg, order: 2, color: '#3B82F6' })
  }

  // ── LIMPIEZA ─────────────────────────────────────────────────────────────
  const deptLimp = get('Limpieza')
  if (deptLimp) {
    const solicLimp = await upsertCategory({ name: 'Solicitud de Limpieza', description: 'Solicitudes al servicio de limpieza', level: 1, parentId: null, departmentId: deptLimp, order: 1, color: '#06B6D4' })
    await upsertCategory({ name: 'Limpieza de Área', description: 'Solicitud de limpieza de un área específica', level: 2, parentId: solicLimp.id, departmentId: deptLimp, order: 1, color: '#06B6D4' })
    await upsertCategory({ name: 'Limpieza Profunda', description: 'Solicitud de limpieza profunda o desinfección', level: 2, parentId: solicLimp.id, departmentId: deptLimp, order: 2, color: '#06B6D4' })
    await upsertCategory({ name: 'Derrame / Emergencia', description: 'Limpieza urgente por derrame u emergencia', level: 2, parentId: solicLimp.id, departmentId: deptLimp, order: 3, color: '#EF4444' })
  }

  // ── GESTIÓN ADMINISTRATIVA ───────────────────────────────────────────────
  const deptAdmin = get('Administración')
  if (deptAdmin) {
    const solicAdmin = await upsertCategory({ name: 'Solicitud Administrativa', description: 'Solicitudes al área administrativa', level: 1, parentId: null, departmentId: deptAdmin, order: 1, color: '#6B7280' })
    await upsertCategory({ name: 'Documentos / Certificados', description: 'Solicitud de documentos o certificados', level: 2, parentId: solicAdmin.id, departmentId: deptAdmin, order: 1, color: '#6B7280' })
    await upsertCategory({ name: 'Permisos / Autorizaciones', description: 'Solicitud de permisos o autorizaciones', level: 2, parentId: solicAdmin.id, departmentId: deptAdmin, order: 2, color: '#6B7280' })
    await upsertCategory({ name: 'Facturación / Pagos', description: 'Consultas o solicitudes de facturación', level: 2, parentId: solicAdmin.id, departmentId: deptAdmin, order: 3, color: '#6B7280' })
  }

  console.log('✅ Categorías otras familias (Mantenimiento, Seguridad, Servicios, Administrativa)')
}

// ============================================
// TIPOS DE PROVEEDOR (dinámicos, reemplaza enum SupplierType)
// ============================================

async function seedSupplierTypes(familyMap: Map<string, string>) {
  const types = [
    { code: 'EQUIPMENT',   name: 'Equipos',      description: 'Proveedor de equipos tecnológicos y hardware' },
    { code: 'CONSUMABLE',  name: 'Consumibles',  description: 'Proveedor de materiales MRO y consumibles' },
    { code: 'LICENSE',     name: 'Licencias',    description: 'Proveedor de software y licencias' },
    { code: 'MIXED',       name: 'Mixto',        description: 'Proveedor de múltiples categorías' },
    { code: 'SERVICE',     name: 'Servicios',    description: 'Proveedor de servicios y mantenimiento' },
    { code: 'FIXED_ASSETS', name: 'Activos Fijos', description: 'Proveedor de activos fijos e infraestructura', familyCode: 'FIXED_ASSETS' },
    { code: 'MAINTENANCE',  name: 'Mantenimiento', description: 'Proveedor de servicios de mantenimiento',       familyCode: 'MAINTENANCE' },
  ]

  for (const [i, t] of types.entries()) {
    const familyId = t.familyCode ? (familyMap.get(t.familyCode) ?? null) : null
    const id = randomUUID()
    await prisma.$executeRaw`
      INSERT INTO supplier_types (id, code, name, description, family_id, is_active, "order", created_at, updated_at)
      VALUES (${id}, ${t.code}, ${t.name}, ${t.description ?? null}, ${familyId}, true, ${i + 1}, NOW(), NOW())
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        family_id = EXCLUDED.family_id,
        "order" = EXCLUDED."order",
        updated_at = NOW()
    `
  }
  console.log('✅ Tipos de proveedor')
}

async function migrateSupplierTypes() {
  // Si la columna 'type' (enum) aún existe en suppliers, migrar a typeId
  try {
    await prisma.$executeRaw`
      UPDATE suppliers s
      SET type_id = st.id
      FROM supplier_types st
      WHERE s.type_id IS NULL
        AND st.code = s.type::text
    `
    console.log('✅ Migración suppliers type → typeId')
  } catch {
    // La columna type puede no existir si ya se hizo la migración
    console.log('⏭️  Migración suppliers (columna type no existe o ya migrada)')
  }
}
