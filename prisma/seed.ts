import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID, createHash } from 'crypto'
import { seedCustomFields } from './seeds/custom-fields.seed'
import { seedInventoryTypes } from './seeds/inventory-types.seed'
import { seedEquipmentBrands, syncBrandFamilies } from './seeds/equipment-brands.seed'
import { seedCategoriesTechnology } from './seeds/categories-technology.seed'
import { seedCategoriesArchitecture } from './seeds/categories-architecture.seed'
import { seedCategoriesMaintenance } from './seeds/categories-maintenance.seed'
import { seedCategoriesServices } from './seeds/categories-services.seed'
import { seedCategoriesSecurity } from './seeds/categories-security.seed'
import { seedCategoriesGreenAreas } from './seeds/categories-green-areas.seed'
import { seedCategoriesAdministrative } from './seeds/categories-administrative.seed'
import { seedCategoriesCommercial } from './seeds/categories-commercial.seed'
import { seedAttributes } from './seeds/attributes.seed'
import { seedWarehouses } from './seeds/warehouses.seed'
import { ORGANIGRAM_FAMILIES } from './seeds/family-map'
import { DEPARTMENT_SEEDS } from './seeds/department-family-map'
import { seedSupplierTypes } from './seeds/supplier-types.seed'
import { seedAssetRequestsFamilySettings } from './seeds/asset-requests-settings.seed'
import { seedInventoryFamilyConfigs } from './seeds/inventory-family-config.seed'
import { seedUnitsOfMeasure } from './seeds/units-of-measure.seed'
import { seedInventorySettings, seedFolioCounters } from './seeds/inventory-settings.seed'

const prisma = new PrismaClient()
const now = new Date()
const year = now.getFullYear()

/**
 * Genera un UUID v4 determinista basado en un namespace + nombre.
 * El mismo input siempre produce el mismo UUID, garantizando consistencia
 * entre reconstrucciones de contenedores (dev y producción).
 */
function deterministicUUID(namespace: string, name: string): string {
  const hash = createHash('sha256').update(`${namespace}:${name}`).digest('hex')
  // Formatear como UUID v4 (con bits fijos según el estándar)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16), // versión 4
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20), // variante RFC4122
    hash.slice(20, 32),
  ].join('-')
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🌱 Iniciando seed (organigrama PSF)...\n')

  const familyMap = await seedFamilies()

  // 2. CONFIGURACIONES DE TICKETS POR FAMILIA
  await seedTicketFamilyConfigs(familyMap)

  // 3. CONFIGURACIONES DE INVENTARIO POR FAMILIA
  await seedInventoryFamilyConfigs(prisma, familyMap)
  await seedAssetRequestsFamilySettings(prisma, familyMap)

  // 4. DEPARTAMENTOS (con familyId directo) + sync aliases / legacy TECHNOLOGY
  const deptMap = await seedDepartments(familyMap)
  const { ensureDepartments } = await import('./ensure-departments')
  await ensureDepartments(prisma)
  // Refrescar mapa por si hubo renombres/fusiones
  for (const dept of await prisma.departments.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })) {
    deptMap.set(dept.name, dept.id)
  }

  // 5. USUARIO ADMINISTRADOR
  const adminId = await seedAdmin(deptMap.get('Administración')!)

  // 6. CONFIGURACIÓN DEL SITIO
  await seedSiteConfig()

  // 8. POLÍTICAS DE SLA (globales + por familia ADMINISTRATIVE / TI)
  await seedSLAPolicies(familyMap)

  // 9. CATEGORÍAS DE TICKETS (un archivo por familia/área)
  await seedCategoriesTechnology(prisma, deptMap)
  await seedCategoriesAdministrative(prisma, deptMap)
  await seedCategoriesCommercial(prisma, deptMap)
  await seedCategoriesArchitecture(prisma, deptMap)
  await seedCategoriesMaintenance(prisma, deptMap)
  await seedCategoriesSecurity(prisma, deptMap)
  await seedCategoriesGreenAreas(prisma, deptMap)
  await seedCategoriesServices(prisma, deptMap)
  await syncCategoryFamilies()

  // 10. TIPOS DE INVENTARIO (equipos, licencias, consumibles)
  await seedInventoryTypes(prisma, familyMap)

  // 11. MARCAS DE EQUIPOS
  await seedEquipmentBrands(prisma, familyMap)
  await syncBrandFamilies(prisma, familyMap)

  // 13. UNIDADES DE MEDIDA
  await seedUnitsOfMeasure(prisma)

  // 13b. TIPOS DE PROVEEDOR
  await seedSupplierTypes(prisma, familyMap)

  // 13c. CAMPOS PERSONALIZADOS (custom fields por familia)
  await seedCustomFields(prisma, familyMap)

  // 13e. ATRIBUTOS DE TIPOS (equipment, license, consumable)
  await seedAttributes(prisma, familyMap)

  // 13f. BODEGAS POR FAMILIA
  await seedWarehouses(prisma, familyMap)

  // 14. CONFIGURACIONES DE INVENTARIO (system_settings)
  await seedInventorySettings(prisma)

  // 15. CONTADORES DE FOLIO
  await seedFolioCounters(prisma)

  // 16. CONTADORES DE CÓDIGO DE TICKET
  await seedTicketCodeCounters(familyMap)

  // 17. LIMPIAR BODEGAS HUÉRFANAS (sin familyId)
  await cleanOrphanWarehouses()

  // 18. LANDING PAGE
  await seedLandingPage()

  // 19. ARTÍCULOS DE BASE DE CONOCIMIENTOS — omitido (sin datos de ejemplo)

  // 20. MÓDULOS DEL SISTEMA
  await seedSystemModules()
}

// ============================================
// 1. FAMILIAS GLOBALES
// ============================================

async function seedFamilies(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const f of ORGANIGRAM_FAMILIES) {
    const family = await prisma.families.upsert({
      where: { code: f.code },
      update: { name: f.name, icon: f.icon, color: f.color, order: f.order, isActive: true },
      create: { id: deterministicUUID('family', f.code), ...f, isActive: true },
    })
    map.set(f.code, family.id)
  }
  console.log(`✅ ${ORGANIGRAM_FAMILIES.length} familias (organigrama PSF)`)
  return map
}

// ============================================
// 2. CONFIGURACIONES DE TICKETS POR FAMILIA
// ============================================

async function seedTicketFamilyConfigs(familyMap: Map<string, string>) {
  // Familias con tickets habilitados
  // allowedFromFamilies vacío = acepta de TODAS las familias
  const enabledFamilies = [
    { code: 'ADMINISTRATIVE', prefix: 'ADM', isDefault: true, allowedFromFamilies: [] },
    { code: 'COMMERCIAL', prefix: 'COM', isDefault: false, allowedFromFamilies: [] },
    { code: 'MARKETING', prefix: 'MKT', isDefault: false, allowedFromFamilies: [] },
    { code: 'ARCHITECTURE', prefix: 'ARQ', isDefault: false, allowedFromFamilies: [] },
    { code: 'OPERATIONS', prefix: 'OPE', isDefault: false, allowedFromFamilies: [] },
  ]

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
  console.log('✅ Configuraciones de tickets por familia')
}

// ============================================
// 4. DEPARTAMENTOS (con familyId directo)
// ============================================

async function seedDepartments(familyMap: Map<string, string>): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const dept of DEPARTMENT_SEEDS) {
    const familyId = familyMap.get(dept.familyCode)!
    const d = await prisma.departments.upsert({
      where: { name: dept.name },
      update: { description: dept.description, color: dept.color, order: dept.order, familyId },
      create: {
        id: deterministicUUID('department', dept.name),
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
  console.log(`✅ ${DEPARTMENT_SEEDS.length} departamentos con familyId`)
  return map
}

/** Sincroniza categories.family_id desde el departamento (misma query que ensure-categories) */
async function syncCategoryFamilies() {
  const updated = await prisma.$executeRaw`
    UPDATE categories c
    SET family_id = d.family_id,
        "updatedAt" = NOW()
    FROM departments d
    WHERE c."departmentId" = d.id
      AND d.family_id IS NOT NULL
      AND (c.family_id IS NULL OR c.family_id <> d.family_id)
  `
  console.log(`✅ Categorías sincronizadas con familia del departamento (${updated} filas)`)
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
      value: 'Gestión Operaciones',
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

  const adminFamilyId = familyMap.get('ADMINISTRATIVE')!

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

  // SLA estrictos para Administración (incluye TI)
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
      familyId: adminFamilyId,
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
      familyId: adminFamilyId,
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
      familyId: adminFamilyId,
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
      familyId: adminFamilyId,
    },
  ]
  for (const p of techPolicies) {
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true } })
  }
  console.log(
    `✅ ${globalPolicies.length} SLA globales + ${techPolicies.length} SLA para Administración (TI)`
  )
}

// ============================================
// 9. CATEGORÍAS (por familia / departamento)
// ============================================

// ============================================
// 16. CONTADORES DE CÓDIGO DE TICKET
// ============================================

async function seedTicketCodeCounters(familyMap: Map<string, string>) {
  const familiesWithSeq: Array<{ code: string; lastSequence: number }> = [
    { code: 'ADMINISTRATIVE', lastSequence: 0 },
    { code: 'COMMERCIAL', lastSequence: 0 },
    { code: 'MARKETING', lastSequence: 0 },
    { code: 'ARCHITECTURE', lastSequence: 0 },
    { code: 'OPERATIONS', lastSequence: 0 },
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
// 17. LIMPIAR BODEGAS HUÉRFANAS (sin familyId)
// ============================================
// Las bodegas deben pertenecer exclusivamente a una familia.
// Bodegas con familyId=null son huérfanas: se eliminan si no tienen ítems,
// o se registra una advertencia para corrección manual si tienen ítems asignados.

async function cleanOrphanWarehouses() {
  // familyId es NOT NULL en el schema actual — no pueden existir bodegas huérfanas.
  // Usamos una raw query para verificar por si acaso hay datos legacy (migración anterior).
  try {
    const orphans: any[] = await prisma.$queryRaw`
      SELECT id, name FROM warehouses WHERE family_id IS NULL
    `

    if (orphans.length === 0) {
      console.log('✅ No hay bodegas huérfanas (sin familyId)')
      return
    }

    let deleted = 0
    for (const warehouse of orphans) {
      // Verificar si tiene ítems antes de eliminar
      const [eqCount, conCount, batchCount] = await Promise.all([
        prisma.equipment.count({ where: { warehouseId: warehouse.id } }),
        prisma.consumables.count({ where: { warehouseId: warehouse.id } }),
        prisma.equipment_batches.count({ where: { warehouseId: warehouse.id } }),
      ])

      if (eqCount + conCount + batchCount === 0) {
        await prisma.$executeRaw`DELETE FROM warehouses WHERE id = ${warehouse.id}`
        deleted++
      } else {
        console.warn(
          `⚠️  Bodega huérfana "${warehouse.name}" (${warehouse.id}) tiene ítems — asignar familyId manualmente`
        )
      }
    }

    if (deleted > 0) console.log(`🗑️  ${deleted} bodega(s) huérfana(s) eliminada(s)`)
  } catch (error: any) {
    // En BD fresca no hay datos legacy — ignorar silenciosamente
    console.log('✅ No hay bodegas huérfanas (campo familyId es NOT NULL)')
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
        id: 'default',
        heroTitle: 'Soporte Multi-Área',
        heroSubtitle: 'Gestión de tickets para todas las áreas de tu organización',
        heroCtaPrimary: 'Crear Ticket de Soporte',
        heroCtaPrimaryUrl: '/login',
        heroCtaSecondary: 'Ver Servicios',
        heroCtaSecondaryUrl: '#servicios',
        servicesTitle: 'Nuestros Servicios',
        servicesSubtitle: 'Soporte técnico integral para todas las áreas',
        servicesEnabled: true,
        companyName: 'Gestión Operaciones',
        companyTagline: 'Soporte profesional para toda la organización',
        footerText: `© ${year} Gestión Operaciones. Todos los derechos reservados.`,
        metaTitle: 'Gestión Operaciones',
        metaDescription: 'Sistema profesional de gestión de tickets multi-área',
        showStats: false,
        showTestimonials: false,
        showFaq: false,
      },
    })
  }
  const existingServices = await prisma.landing_page_services.count()
  if (existingServices === 0) {
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
      await prisma.landing_page_services.create({ data: s })
    }
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
