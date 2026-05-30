import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { seedCustomFields } from './seeds/custom-fields.seed'
import { seedInventoryTypes } from './seeds/inventory-types.seed'
import { seedEquipmentBrands } from './seeds/equipment-brands.seed'
import { seedCategories, seedCategoriesOtherFamilies } from './seeds/categories.seed'
import { seedCategoriesTechnology } from './seeds/categories-technology.seed'
import { seedCategoriesFixedAssets } from './seeds/categories-fixed-assets.seed'
import { seedCategoriesMaintenance } from './seeds/categories-maintenance.seed'
import { seedCategoriesServices } from './seeds/categories-services.seed'
import { seedCategoriesSecurity } from './seeds/categories-security.seed'
import { seedCategoriesGreenAreas } from './seeds/categories-green-areas.seed'
import { seedCategoriesAdministrative } from './seeds/categories-administrative.seed'
import { seedCategoriesCommercial } from './seeds/categories-commercial.seed'
import { seedAttributes } from './seeds/attributes.seed'
import { seedWarehouses } from './seeds/warehouses.seed'

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
  await seedCategories(prisma, deptMap)

  // 9b. CATEGORÍAS OTRAS FAMILIAS (Mantenimiento, Seguridad, Servicios, Administrativa)
  await seedCategoriesOtherFamilies(prisma, deptMap)

  // NOTA: categories-technology.seed.ts es el archivo organizado para Tecnología y Comunicaciones

  // 9c. CATEGORÍAS FAMILIAS COMPLETAS (Centro Comercial)
  await seedCategoriesFixedAssets(prisma, deptMap)
  await seedCategoriesMaintenance(prisma, deptMap)
  await seedCategoriesServices(prisma, deptMap)
  await seedCategoriesSecurity(prisma, deptMap)
  await seedCategoriesGreenAreas(prisma, deptMap)
  await seedCategoriesAdministrative(prisma, deptMap)
  await seedCategoriesCommercial(prisma, deptMap)

  // 10. TIPOS DE INVENTARIO (equipos, licencias, consumibles)
  await seedInventoryTypes(prisma, familyMap)

  // 11. MARCAS DE EQUIPOS
  await seedEquipmentBrands(prisma, familyMap)

  // 13. UNIDADES DE MEDIDA
  await seedUnitsOfMeasure()

  // 13b. TIPOS DE PROVEEDOR
  await seedSupplierTypes(familyMap)

  // 13c. CAMPOS PERSONALIZADOS (custom fields por familia)
  await seedCustomFields(prisma, familyMap)

  // 13d. MIGRAR suppliers existentes: type enum → typeId
  await migrateSupplierTypes()

  // 13e. ATRIBUTOS DE TIPOS (equipment, license, consumable)
  await seedAttributes(prisma, familyMap)

  // 13f. BODEGAS POR FAMILIA
  await seedWarehouses(prisma, familyMap)

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

  // 20. MÓDULOS DEL SISTEMA
  await seedSystemModules()
}

// ============================================
// HELPERS
// ============================================

async function upsertCategory(data: {
  name: string
  description: string
  level: number
  parentId: string | null
  departmentId: string
  order: number
  color: string
}) {
  const existing = await prisma.categories.findFirst({
    where: { name: data.name, level: data.level, parentId: data.parentId },
  })
  if (existing) {
    return prisma.categories.update({
      where: { id: existing.id },
      data: {
        description: data.description,
        departmentId: data.departmentId,
        order: data.order,
        color: data.color,
        updatedAt: now,
      },
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
    {
      code: 'TECHNOLOGY',
      name: 'Tecnología y Comunicaciones',
      icon: 'Monitor',
      color: '#3B82F6',
      order: 1,
    },
    {
      code: 'FIXED_ASSETS',
      name: 'Activos Fijos e Infraestructura',
      icon: 'Building2',
      color: '#F59E0B',
      order: 2,
    },
    { code: 'MAINTENANCE', name: 'Mantenimiento', icon: 'Wrench', color: '#10B981', order: 3 },
    { code: 'SERVICES', name: 'Servicios Generales', icon: 'Settings', color: '#8B5CF6', order: 4 },
    { code: 'SECURITY', name: 'Seguridad', icon: 'Shield', color: '#EF4444', order: 5 },
    { code: 'GREEN_AREAS', name: 'Áreas Verdes', icon: 'Leaf', color: '#22C55E', order: 6 },
    {
      code: 'ADMINISTRATIVE',
      name: 'Gestión Administrativa',
      icon: 'Briefcase',
      color: '#6B7280',
      order: 7,
    },
    {
      code: 'COMMERCIAL',
      name: 'Comercial y Marketing',
      icon: 'TrendingUp',
      color: '#EC4899',
      order: 8,
    },
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
    { code: 'TECHNOLOGY', prefix: 'TI', isDefault: true, allowedFromFamilies: [] },
    { code: 'FIXED_ASSETS', prefix: 'INF', isDefault: false, allowedFromFamilies: [] },
    { code: 'MAINTENANCE', prefix: 'MNT', isDefault: false, allowedFromFamilies: [] },
    { code: 'SERVICES', prefix: 'SRV', isDefault: false, allowedFromFamilies: [] },
    { code: 'SECURITY', prefix: 'SEG', isDefault: false, allowedFromFamilies: [] },
    { code: 'ADMINISTRATIVE', prefix: 'ADM', isDefault: false, allowedFromFamilies: [] },
    { code: 'COMMERCIAL', prefix: 'COM', isDefault: false, allowedFromFamilies: [] },
  ]
  // GREEN_AREAS: ticketsEnabled = false
  const disabledFamilies = ['GREEN_AREAS']

  for (const f of enabledFamilies) {
    const familyId = familyMap.get(f.code)!
    await prisma.ticket_family_config.upsert({
      where: { familyId },
      update: {
        codePrefix: f.prefix,
        isDefault: f.isDefault,
        ticketsEnabled: true,
        allowedFromFamilies: f.allowedFromFamilies,
      } as any,
      create: {
        id: randomUUID(),
        familyId,
        ticketsEnabled: true,
        codePrefix: f.prefix,
        isDefault: f.isDefault,
        allowedFromFamilies: f.allowedFromFamilies,
        autoAssignRespectsFamilies: true,
        alertVolumeThreshold: 50,
        businessHoursStart: '08:00:00',
        businessHoursEnd: '17:00:00',
        businessDays: 'MON,TUE,WED,THU,FRI',
      } as any,
    })
  }
  for (const code of disabledFamilies) {
    const familyId = familyMap.get(code)!
    await prisma.ticket_family_config.upsert({
      where: { familyId },
      update: { ticketsEnabled: false } as any,
      create: {
        id: randomUUID(),
        familyId,
        ticketsEnabled: false,
        codePrefix: code.slice(0, 5),
        isDefault: false,
        allowedFromFamilies: [],
        autoAssignRespectsFamilies: true,
        businessHoursStart: '08:00:00',
        businessHoursEnd: '17:00:00',
        businessDays: 'MON,TUE,WED,THU,FRI',
      } as any,
    })
  }
  console.log('✅ Configuraciones de tickets por familia (allowedFromFamilies vacío = todas)')
}

// ============================================
// 3. CONFIGURACIONES DE INVENTARIO POR FAMILIA
// ============================================

async function seedInventoryFamilyConfigs(familyMap: Map<string, string>) {
  const configs: Record<
    string,
    { allowedSubtypes: any[]; visibleSections: any[]; requiredSections: any[] }
  > = {
    TECHNOLOGY: {
      allowedSubtypes: ['EQUIPMENT', 'LICENSE', 'MRO'],
      visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'WAREHOUSE'],
      requiredSections: ['FINANCIAL'],
    },
    FIXED_ASSETS: {
      allowedSubtypes: ['EQUIPMENT', 'LICENSE', 'MRO'],
      visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT', 'WAREHOUSE'],
      requiredSections: ['FINANCIAL', 'DEPRECIATION'],
    },
    MAINTENANCE: {
      allowedSubtypes: ['MRO'],
      visibleSections: ['FINANCIAL', 'STOCK_MRO', 'WAREHOUSE'],
      requiredSections: ['FINANCIAL'],
    },
    SERVICES: {
      allowedSubtypes: ['MRO', 'LICENSE'],
      visibleSections: ['FINANCIAL', 'CONTRACT', 'STOCK_MRO'],
      requiredSections: [],
    },
    SECURITY: {
      allowedSubtypes: ['EQUIPMENT', 'MRO'],
      visibleSections: ['FINANCIAL', 'DEPRECIATION', 'WAREHOUSE'],
      requiredSections: ['FINANCIAL'],
    },
    GREEN_AREAS: {
      allowedSubtypes: ['MRO'],
      visibleSections: ['FINANCIAL', 'STOCK_MRO'],
      requiredSections: [],
    },
    ADMINISTRATIVE: {
      allowedSubtypes: ['EQUIPMENT', 'LICENSE'],
      visibleSections: ['FINANCIAL', 'CONTRACT'],
      requiredSections: [],
    },
    COMMERCIAL: {
      allowedSubtypes: ['EQUIPMENT', 'LICENSE'],
      visibleSections: ['FINANCIAL', 'DEPRECIATION', 'CONTRACT'],
      requiredSections: ['FINANCIAL'],
    },
  }
  for (const [code, cfg] of Object.entries(configs)) {
    const familyId = familyMap.get(code)!
    await prisma.inventory_family_config.upsert({
      where: { familyId },
      update: {
        allowedSubtypes: cfg.allowedSubtypes as any,
        visibleSections: cfg.visibleSections as any,
        requiredSections: cfg.requiredSections as any,
      },
      create: {
        id: randomUUID(),
        familyId,
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
    {
      name: 'Administración',
      description: 'Departamento de Administración del Sistema',
      color: '#3B82F6',
      order: 1,
      familyCode: 'ADMINISTRATIVE',
    },
    {
      name: 'Contabilidad',
      description: 'Departamento de Contabilidad y Finanzas',
      color: '#EF4444',
      order: 2,
      familyCode: 'ADMINISTRATIVE',
    },
    {
      name: 'Compras',
      description: 'Departamento de Compras y Adquisiciones',
      color: '#06B6D4',
      order: 3,
      familyCode: 'ADMINISTRATIVE',
    },
    {
      name: 'Recursos Humanos',
      description: 'Departamento de Talento Humano y RRHH',
      color: '#8B5CF6',
      order: 4,
      familyCode: 'ADMINISTRATIVE',
    },
    {
      name: 'Seguridad y Salud Ocupacional',
      description: 'Departamento de SSO',
      color: '#14B8A6',
      order: 5,
      familyCode: 'ADMINISTRATIVE',
    },
    // TECHNOLOGY
    {
      name: 'Tecnologías de la Información',
      description: 'Departamento de TI - Infraestructura y Sistemas',
      color: '#10B981',
      order: 6,
      familyCode: 'TECHNOLOGY',
    },
    {
      name: 'Soporte Técnico',
      description: 'Departamento de Soporte y Mesa de Ayuda',
      color: '#F59E0B',
      order: 7,
      familyCode: 'TECHNOLOGY',
    },
    {
      name: 'Seguridad Informática',
      description: 'Departamento de Seguridad de la Información',
      color: '#DC2626',
      order: 8,
      familyCode: 'TECHNOLOGY',
    },
    {
      name: 'Usuarios y Privilegios',
      description: 'Departamento de Gestión de Usuarios y Accesos',
      color: '#6366F1',
      order: 9,
      familyCode: 'TECHNOLOGY',
    },
    {
      name: 'Telefonía',
      description: 'Departamento de Telefonía y Comunicaciones',
      color: '#0EA5E9',
      order: 10,
      familyCode: 'TECHNOLOGY',
    },
    // COMMERCIAL
    {
      name: 'Comercial',
      description: 'Departamento Comercial y Ventas',
      color: '#F97316',
      order: 11,
      familyCode: 'COMMERCIAL',
    },
    {
      name: 'Marketing',
      description: 'Departamento de Marketing y Publicidad',
      color: '#EC4899',
      order: 12,
      familyCode: 'COMMERCIAL',
    },
    // FIXED_ASSETS
    {
      name: 'Arquitectura',
      description: 'Departamento de Arquitectura y Diseño',
      color: '#6366F1',
      order: 13,
      familyCode: 'FIXED_ASSETS',
    },
    {
      name: 'Mantenimiento',
      description: 'Departamento de Mantenimiento e Infraestructura',
      color: '#84CC16',
      order: 14,
      familyCode: 'FIXED_ASSETS',
    },
    // MAINTENANCE
    {
      name: 'Mantenimiento Civil',
      description: 'Mantenimiento de obras civiles e infraestructura',
      color: '#10B981',
      order: 15,
      familyCode: 'MAINTENANCE',
    },
    {
      name: 'Mantenimiento Eléctrico',
      description: 'Mantenimiento de instalaciones eléctricas',
      color: '#F59E0B',
      order: 16,
      familyCode: 'MAINTENANCE',
    },
    {
      name: 'Mantenimiento Mecánico',
      description: 'Mantenimiento de equipos mecánicos',
      color: '#EF4444',
      order: 17,
      familyCode: 'MAINTENANCE',
    },
    // SECURITY
    {
      name: 'Seguridad Física',
      description: 'Seguridad física y vigilancia',
      color: '#EF4444',
      order: 18,
      familyCode: 'SECURITY',
    },
    {
      name: 'CCTV y Control de Acceso',
      description: 'Cámaras, control de acceso y alarmas',
      color: '#DC2626',
      order: 19,
      familyCode: 'SECURITY',
    },
    // SERVICES
    {
      name: 'Limpieza',
      description: 'Servicios de limpieza y aseo',
      color: '#06B6D4',
      order: 20,
      familyCode: 'SERVICES',
    },
    {
      name: 'Mensajería',
      description: 'Servicios de mensajería y correspondencia',
      color: '#8B5CF6',
      order: 21,
      familyCode: 'SERVICES',
    },
    // GREEN_AREAS
    {
      name: 'Áreas Verdes',
      description: 'Mantenimiento de jardines y áreas verdes',
      color: '#22C55E',
      order: 22,
      familyCode: 'GREEN_AREAS',
    },
  ]
  const map = new Map<string, string>()
  for (const dept of departments) {
    const familyId = familyMap.get(dept.familyCode)!
    const d = await prisma.departments.upsert({
      where: { name: dept.name },
      update: { description: dept.description, color: dept.color, order: dept.order, familyId },
      create: {
        id: randomUUID(),
        name: dept.name,
        description: dept.description,
        color: dept.color,
        order: dept.order,
        familyId,
        createdAt: now,
        updatedAt: now,
      },
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
    update: {
      isSuperAdmin: true,
      inventoryEnabled: true,
      canManageInventory: true,
      ticketsEnabled: true,
      newsEnabled: true,
    },
    create: {
      id: randomUUID(),
      email: 'internet.freecom@gmail.com',
      name: 'Administrador del Sistema',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      departmentId: deptAdminId,
      phone: '+593999999999',
      isActive: true,
      isEmailVerified: true,
      isSuperAdmin: true,
      inventoryEnabled: true,
      canManageInventory: true,
      ticketsEnabled: true,
      newsEnabled: true,
      createdAt: now,
      updatedAt: now,
    },
  })
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
  await prisma.user_settings.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      id: randomUUID(),
      userId: admin.id,
      theme: 'light',
      language: 'es',
      timezone: 'America/Guayaquil',
      updatedAt: now,
    },
  })
  console.log('✅ Administrador (internet.freecom@gmail.com / admin123)')
  return admin.id
}

// ============================================
// 7. CONFIGURACIÓN DEL SITIO
// ============================================

async function seedSiteConfig() {
  const configs = [
    {
      key: 'site_name',
      value: 'Sistema de Tickets Multi-Familia',
      description: 'Nombre del sitio web',
    },
    { key: 'company_name', value: 'Mi Empresa', description: 'Nombre de la empresa' },
    {
      key: 'support_email',
      value: 'internet.freecom@gmail.com',
      description: 'Email de soporte técnico',
    },
    {
      key: 'max_file_size',
      value: '10485760',
      description: 'Tamaño máximo de archivo en bytes (10MB)',
    },
    {
      key: 'allowed_file_types',
      value: 'pdf,doc,docx,txt,png,jpg,jpeg,gif',
      description: 'Tipos de archivo permitidos',
    },
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
  if (existing > 0) {
    console.log(`⏭️  SLA ya existe (${existing})`)
    return
  }

  const techFamilyId = familyMap.get('TECHNOLOGY')!

  // SLA globales (sin familia — fallback para todas las familias)
  const globalPolicies = [
    {
      name: 'Global - Urgente 24/7',
      priority: 'URGENT',
      responseTimeHours: 2,
      resolutionTimeHours: 8,
      businessHoursOnly: false,
      businessHoursStart: '00:00:00',
      businessHoursEnd: '23:59:59',
      businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN',
    },
    {
      name: 'Global - Alta Prioridad',
      priority: 'HIGH',
      responseTimeHours: 8,
      resolutionTimeHours: 48,
      businessHoursOnly: true,
      businessHoursStart: '08:00:00',
      businessHoursEnd: '17:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
    },
    {
      name: 'Global - Prioridad Media',
      priority: 'MEDIUM',
      responseTimeHours: 24,
      resolutionTimeHours: 72,
      businessHoursOnly: true,
      businessHoursStart: '08:00:00',
      businessHoursEnd: '17:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
    },
    {
      name: 'Global - Baja Prioridad',
      priority: 'LOW',
      responseTimeHours: 48,
      resolutionTimeHours: 120,
      businessHoursOnly: true,
      businessHoursStart: '08:00:00',
      businessHoursEnd: '17:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
    },
  ]
  for (const p of globalPolicies) {
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true } })
  }

  // SLA estrictos para TECHNOLOGY
  const techPolicies = [
    {
      name: 'TI - Urgente 24/7',
      priority: 'URGENT',
      responseTimeHours: 1,
      resolutionTimeHours: 4,
      businessHoursOnly: false,
      businessHoursStart: '00:00:00',
      businessHoursEnd: '23:59:59',
      businessDays: 'MON,TUE,WED,THU,FRI,SAT,SUN',
      familyId: techFamilyId,
    },
    {
      name: 'TI - Alta Prioridad',
      priority: 'HIGH',
      responseTimeHours: 2,
      resolutionTimeHours: 8,
      businessHoursOnly: true,
      businessHoursStart: '08:00:00',
      businessHoursEnd: '17:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      familyId: techFamilyId,
    },
    {
      name: 'TI - Prioridad Media',
      priority: 'MEDIUM',
      responseTimeHours: 4,
      resolutionTimeHours: 24,
      businessHoursOnly: true,
      businessHoursStart: '08:00:00',
      businessHoursEnd: '17:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      familyId: techFamilyId,
    },
    {
      name: 'TI - Baja Prioridad',
      priority: 'LOW',
      responseTimeHours: 8,
      resolutionTimeHours: 48,
      businessHoursOnly: true,
      businessHoursStart: '08:00:00',
      businessHoursEnd: '17:00:00',
      businessDays: 'MON,TUE,WED,THU,FRI',
      familyId: techFamilyId,
    },
  ]
  for (const p of techPolicies) {
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true } })
  }
  console.log(
    `✅ ${globalPolicies.length} SLA globales + ${techPolicies.length} SLA para TECHNOLOGY`
  )
}

// ============================================
// 9. CATEGORÍAS (todas bajo TECHNOLOGY)
// ============================================

async function seedUnitsOfMeasure() {
  const units = [
    { code: 'UNIT', name: 'Unidad', symbol: 'ud', order: 1 },
    { code: 'BOX', name: 'Caja', symbol: 'caja', order: 2 },
    { code: 'PACK', name: 'Paquete', symbol: 'paq', order: 3 },
    { code: 'REAM', name: 'Resma', symbol: 'resma', order: 4 },
    { code: 'METER', name: 'Metro', symbol: 'm', order: 5 },
    { code: 'LITER', name: 'Litro', symbol: 'L', order: 6 },
    { code: 'KG', name: 'Kilogramo', symbol: 'kg', order: 7 },
    { code: 'SET', name: 'Juego', symbol: 'juego', order: 8 },
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
    {
      key: 'inventory.act_expiration_days',
      value: '7',
      description: 'Días de expiración para actas',
    },
    {
      key: 'inventory.low_stock_alert_enabled',
      value: 'true',
      description: 'Habilitar alertas de stock bajo',
    },
    {
      key: 'inventory.license_alert_enabled',
      value: 'true',
      description: 'Habilitar alertas de vencimiento de licencias',
    },
    {
      key: 'inventory.license_alert_days_first',
      value: '30',
      description: 'Días antes para primera alerta de licencias',
    },
    {
      key: 'inventory.license_alert_days_second',
      value: '7',
      description: 'Días antes para segunda alerta de licencias',
    },
    {
      key: 'inventory.warranty_alert_days',
      value: '30',
      description: 'Días antes de vencimiento de garantía',
    },
    {
      key: 'inventory.mro_expiry_alert_enabled',
      value: 'true',
      description: 'Habilita alertas de caducidad MRO',
    },
    {
      key: 'inventory.warranty_alert_enabled',
      value: 'true',
      description: 'Habilita alertas de garantía de equipos',
    },
    { key: 'inventory.default_warehouse_id', value: '', description: 'ID de bodega por defecto' },
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
    { code: 'TECHNOLOGY', lastSequence: 0 },
    { code: 'FIXED_ASSETS', lastSequence: 0 },
    { code: 'ADMINISTRATIVE', lastSequence: 0 },
    { code: 'COMMERCIAL', lastSequence: 0 },
    { code: 'SECURITY', lastSequence: 0 },
    { code: 'MAINTENANCE', lastSequence: 0 },
    { code: 'SERVICES', lastSequence: 0 },
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
      data: {
        id: randomUUID(),
        name: 'Bodega Principal',
        location: 'Instalaciones principales',
        isActive: true,
      },
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
        showStats: false,
        showTestimonials: false,
        showFaq: false,
      },
    })
  }
  const services = [
    {
      id: 'service-1',
      order: 1,
      enabled: true,
      icon: 'Wrench',
      iconColor: 'blue',
      title: 'Soporte TI',
      description: 'Atención de incidencias tecnológicas con seguimiento en tiempo real.',
    },
    {
      id: 'service-2',
      order: 2,
      enabled: true,
      icon: 'Server',
      iconColor: 'green',
      title: 'Gestión de Inventario',
      description: 'Control de equipos, asignaciones y actas de entrega digitales.',
    },
    {
      id: 'service-3',
      order: 3,
      enabled: true,
      icon: 'Building2',
      iconColor: 'orange',
      title: 'Infraestructura',
      description: 'Soporte para activos fijos, mantenimiento e infraestructura.',
    },
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
  .catch(e => {
    console.error('❌ Error durante el seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

// ============================================
// 20. MÓDULOS DEL SISTEMA
// ============================================

async function seedSystemModules() {
  const modules = [
    {
      key: 'tickets',
      name: 'Tickets de Soporte',
      description: 'Gestión de tickets de soporte técnico',
      icon: 'Ticket',
      isActive: true,
      order: 1,
      defaultForAdmin: true,
      defaultForTech: true,
      defaultForClient: true,
      requiresManager: false,
      familyScoped: true,
    },
    {
      key: 'inventory',
      name: 'Inventario',
      description: 'Gestión de activos, equipos y licencias',
      icon: 'Package',
      isActive: true,
      order: 2,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: true,
      familyScoped: true,
    },
    {
      key: 'patrols',
      name: 'Rondas y Patrullajes',
      description: 'Planificación, ejecución y auditoría de rondas de seguridad',
      icon: 'Shield',
      isActive: true,
      order: 3,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: false,
      familyScoped: true,
    },
    {
      key: 'news',
      name: 'Noticias y Comunicados',
      description: 'Gestión de noticias y comunicados internos',
      icon: 'Newspaper',
      isActive: true,
      order: 4,
      defaultForAdmin: true,
      defaultForTech: false,
      defaultForClient: false,
      requiresManager: false,
      familyScoped: false,
    },
  ]

  for (const mod of modules) {
    await (prisma.system_modules as any).upsert({
      where: { key: mod.key },
      update: { name: mod.name, description: mod.description, icon: mod.icon, order: mod.order },
      create: mod,
    })
  }
  console.log('✅ Módulos del sistema (tickets, inventory, patrols, news)')
}

// ============================================
// 9b. CATEGORÍAS OTRAS FAMILIAS
// ============================================

async function seedSupplierTypes(familyMap: Map<string, string>) {
  const types = [
    {
      code: 'EQUIPMENT',
      name: 'Equipos',
      description: 'Proveedor de equipos tecnológicos y hardware',
    },
    {
      code: 'CONSUMABLE',
      name: 'Consumibles',
      description: 'Proveedor de materiales MRO y consumibles',
    },
    { code: 'LICENSE', name: 'Licencias', description: 'Proveedor de software y licencias' },
    { code: 'MIXED', name: 'Mixto', description: 'Proveedor de múltiples categorías' },
    { code: 'SERVICE', name: 'Servicios', description: 'Proveedor de servicios y mantenimiento' },
    {
      code: 'FIXED_ASSETS',
      name: 'Activos Fijos',
      description: 'Proveedor de activos fijos e infraestructura',
      familyCode: 'FIXED_ASSETS',
    },
    {
      code: 'MAINTENANCE',
      name: 'Mantenimiento',
      description: 'Proveedor de servicios de mantenimiento',
      familyCode: 'MAINTENANCE',
    },
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
    // Primero verificar si la columna existe
    const columnExists = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'suppliers' AND column_name = 'type'
      ) AS exists
    `

    if (columnExists[0]?.exists) {
      const result = await prisma.$executeRaw`
        UPDATE suppliers s
        SET type_id = st.id
        FROM supplier_types st
        WHERE s.type_id IS NULL
          AND st.code = s.type::text
      `
      console.log(`✅ Migración suppliers type → typeId (${result} registros actualizados)`)
    } else {
      console.log('⏭️  Migración suppliers (columna type no existe)')
    }
  } catch (error) {
    console.log('⏭️  Migración suppliers (ya migrada o error)', (error as Error)?.message)
  }
}
