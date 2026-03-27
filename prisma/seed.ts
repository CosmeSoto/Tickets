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
  await seedCategoriesFromExcel(
    deptMap.get('Tecnologías de la Información')!,
    deptMap.get('Soporte Técnico')!,
    deptMap.get('Seguridad Informática')!,
    deptMap.get('Usuarios y Privilegios')!,
    deptMap.get('Telefonía')!
  )

  // 6. TIPOS DE EQUIPO
  await seedEquipmentTypes()

  // 7. TIPOS DE LICENCIA
  await seedLicenseTypes()

  // 8. TIPOS DE CONSUMIBLE
  await seedConsumableTypes()

  // 9. UNIDADES DE MEDIDA
  await seedUnitsOfMeasure()

  // 10. CONFIGURACIONES DE INVENTARIO
  await seedInventorySettings()

  // 11. CONTADORES DE FOLIO
  await seedFolioCounters()

  // 12. LANDING PAGE + SERVICIOS
  await seedLandingPage()

  // 13. FAMILIAS DE INVENTARIO
  await seedInventoryFamilies()

  // 14. BODEGA POR DEFECTO
  await seedDefaultWarehouse()

  // 15. MIGRACIÓN CONSERVADORA: tipos existentes → familia TECHNOLOGY
  await migrateExistingTypesToTechnology()

  console.log('\n🎉 Seed completado exitosamente!')
  console.log('\n📋 Credenciales de acceso:')
  console.log('   Email: internet.freecom@gmail.com')
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
    // Administrativos
    { name: 'Administración', description: 'Departamento de Administración del Sistema', color: '#3B82F6', order: 1 },
    { name: 'Contabilidad', description: 'Departamento de Contabilidad y Finanzas', color: '#EF4444', order: 2 },
    { name: 'Compras', description: 'Departamento de Compras y Adquisiciones', color: '#06B6D4', order: 3 },
    
    // Recursos Humanos
    { name: 'Recursos Humanos', description: 'Departamento de Talento Humano y RRHH', color: '#8B5CF6', order: 4 },
    { name: 'Seguridad y Salud Ocupacional', description: 'Departamento de SSO - Seguridad y Salud en el Trabajo', color: '#14B8A6', order: 5 },
    
    // Tecnológicos
    { name: 'Tecnologías de la Información', description: 'Departamento de TI - Infraestructura y Sistemas', color: '#10B981', order: 6 },
    { name: 'Soporte Técnico', description: 'Departamento de Soporte y Mesa de Ayuda', color: '#F59E0B', order: 7 },
    { name: 'Seguridad Informática', description: 'Departamento de Seguridad de la Información', color: '#DC2626', order: 8 },
    { name: 'Usuarios y Privilegios', description: 'Departamento de Gestión de Usuarios y Accesos', color: '#6366F1', order: 9 },
    { name: 'Telefonía', description: 'Departamento de Telefonía y Comunicaciones', color: '#0EA5E9', order: 10 },
    
    // Operativos
    { name: 'Comercial', description: 'Departamento Comercial y Ventas', color: '#F97316', order: 11 },
    { name: 'Marketing', description: 'Departamento de Marketing y Publicidad', color: '#EC4899', order: 12 },
    { name: 'Arquitectura', description: 'Departamento de Arquitectura y Diseño', color: '#6366F1', order: 13 },
    { name: 'Mantenimiento', description: 'Departamento de Mantenimiento e Infraestructura', color: '#84CC16', order: 14 },
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
  console.log('✅ Usuario administrador (internet.freecom@gmail.com / admin123)')
}

async function seedSiteConfig() {
  const configs = [
    { key: 'site_name', value: 'Sistema de Tickets', description: 'Nombre del sitio web' },
    { key: 'company_name', value: 'Mi Empresa', description: 'Nombre de la empresa' },
    { key: 'support_email', value: 'internet.freecom@gmail.com', description: 'Email de soporte técnico' },
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
    await prisma.sla_policies.create({ data: { id: randomUUID(), ...p, isActive: true, createdAt: now } })
  }
  console.log(`✅ ${policies.length} políticas de SLA`)
}

async function seedCategoriesFromExcel(deptInfraId: string, deptSoporteId: string, deptSeguridadId: string, deptUsuariosId: string, deptTelefoniaId: string) {
  
  // ==================== INFRAESTRUCTURA ====================
  
  // Nivel 1 - Infraestructura
  const fallaErrorInfra = await upsertCategory({ 
    name: 'Falla o Error', 
    description: 'Incidentes y fallas en infraestructura', 
    level: 1, 
    parentId: null, 
    departmentId: deptInfraId, 
    order: 1, 
    color: '#EF4444' 
  })
  
  const solicitudRequerimientoInfra = await upsertCategory({ 
    name: 'Solicitud o Requerimiento', 
    description: 'Solicitudes y requerimientos de infraestructura', 
    level: 1, 
    parentId: null, 
    departmentId: deptInfraId, 
    order: 2, 
    color: '#3B82F6' 
  })

  // Nivel 2 - Infraestructura (Falla o Error)
  const networking = await upsertCategory({ 
    name: 'Networking', 
    description: 'Redes, conectividad, comunicaciones, firewall, VPN, central telefónica', 
    level: 2, 
    parentId: fallaErrorInfra.id, 
    departmentId: deptInfraId, 
    order: 1, 
    color: '#10B981' 
  })
  
  const energiaRegulada = await upsertCategory({ 
    name: 'Energía Regulada', 
    description: 'UPS, baterías, energía eléctrica, estabilizadores', 
    level: 2, 
    parentId: fallaErrorInfra.id, 
    departmentId: deptInfraId, 
    order: 2, 
    color: '#F59E0B' 
  })
  
  const gestionOffice365 = await upsertCategory({ 
    name: 'Gestión de Usuarios Office 365', 
    description: 'Plataforma Microsoft 365, Teams, licencias, cuentas', 
    level: 2, 
    parentId: fallaErrorInfra.id, 
    departmentId: deptInfraId, 
    order: 3, 
    color: '#8B5CF6' 
  })

  const impresion = await upsertCategory({ 
    name: 'Impresión', 
    description: 'Impresoras, fotocopiadoras, problemas de impresión', 
    level: 2, 
    parentId: fallaErrorInfra.id, 
    departmentId: deptInfraId, 
    order: 4, 
    color: '#EC4899' 
  })

  // Nivel 2 - Infraestructura (Solicitud o Requerimiento)
  const solicitudRequerimientoN2Infra = await upsertCategory({ 
    name: 'Solicitud o Requerimiento', 
    description: 'Solicitudes generales de infraestructura', 
    level: 2, 
    parentId: solicitudRequerimientoInfra.id, 
    departmentId: deptInfraId, 
    order: 1, 
    color: '#3B82F6' 
  })
  
  const energiaReguladaSolicitud = await upsertCategory({ 
    name: 'Energía Regulada', 
    description: 'Solicitudes de energía regulada, UPS, baterías', 
    level: 2, 
    parentId: solicitudRequerimientoInfra.id, 
    departmentId: deptInfraId, 
    order: 2, 
    color: '#F59E0B' 
  })

  // Nivel 3 - Networking (Fallas)
  await upsertCategory({ name: 'Pérdida de Conexión', description: 'Sin conexión de red, caída de conectividad', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Daño de Equipos Comunicaciones', description: 'Equipos de red dañados, switch, router', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Pérdida de Rutas Comunicación', description: 'Rutas de red perdidas, routing', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Pérdida de Comunicación Inalámbrica', description: 'WiFi caído, señal inalámbrica', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Firewall', description: 'Problemas con firewall, bloqueo de puertos', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 5, color: '#EF4444' })
  await upsertCategory({ name: 'Central Telefónica', description: 'Problemas con PBX, central telefónica', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 6, color: '#EF4444' })
  await upsertCategory({ name: 'VPN', description: 'Problemas con VPN, túnel VPN caído', level: 3, parentId: networking.id, departmentId: deptInfraId, order: 7, color: '#EF4444' })

  // Nivel 3 - Solicitudes Infraestructura
  await upsertCategory({ name: 'Creación de SSID', description: 'Solicitud de nueva red WiFi, SSID', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'VPN', description: 'Solicitud de acceso VPN, configuración VPN', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Fortinet', description: 'Solicitud relacionada con Fortinet, firewall Fortinet', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 3, color: '#3B82F6' })
  await upsertCategory({ name: 'Reportes', description: 'Solicitud de reportes de infraestructura', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 4, color: '#3B82F6' })
  await upsertCategory({ name: 'Creación de Cuenta', description: 'Solicitud de creación de cuenta de usuario', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 5, color: '#3B82F6' })
  await upsertCategory({ name: 'Reseteo Contraseña', description: 'Solicitud de reseteo de contraseña', level: 3, parentId: solicitudRequerimientoN2Infra.id, departmentId: deptInfraId, order: 6, color: '#3B82F6' })

  // Nivel 3 - Energía Regulada (Solicitudes)
  await upsertCategory({ name: 'Nuevos Equipos', description: 'Solicitud de nuevos equipos de energía', level: 3, parentId: energiaReguladaSolicitud.id, departmentId: deptInfraId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Mantenimiento', description: 'Solicitud de mantenimiento de equipos', level: 3, parentId: energiaReguladaSolicitud.id, departmentId: deptInfraId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Reemplazo de Partes', description: 'Solicitud de reemplazo de componentes', level: 3, parentId: energiaReguladaSolicitud.id, departmentId: deptInfraId, order: 3, color: '#3B82F6' })

  // Nivel 3 - Office 365
  await upsertCategory({ name: 'Plataforma Intermitente', description: 'Office 365 intermitente, inestable', level: 3, parentId: gestionOffice365.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })

  // Nivel 3 - Impresión (Fallas)
  await upsertCategory({ name: 'Atasco de Papel', description: 'Impresora atascada, papel trabado', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Baja Calidad de Imagen', description: 'Impresión con baja calidad, borrosa', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Cable de Impresora Dañado', description: 'Cable de red o USB dañado', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Impresora Bloqueada', description: 'Impresora bloqueada, cola de impresión', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Impresora sin Conexión/Red', description: 'Impresora sin conexión de red', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 5, color: '#EF4444' })
  await upsertCategory({ name: 'La Impresora no Digitaliza/Escanea', description: 'Escáner no funciona', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 6, color: '#EF4444' })
  await upsertCategory({ name: 'Impresora hace Ruido Anormal', description: 'Impresora hace ruido anormal', level: 3, parentId: impresion.id, departmentId: deptInfraId, order: 14, color: '#EF4444' })


  // ==================== SOPORTE TÉCNICO ====================
  
  // Nivel 1 - Soporte Técnico
  const fallaErrorSoporte = await upsertCategory({ 
    name: 'Falla o Error', 
    description: 'Incidentes y fallas en soporte técnico', 
    level: 1, 
    parentId: null, 
    departmentId: deptSoporteId, 
    order: 1, 
    color: '#EF4444' 
  })
  
  const solicitudRequerimientoSoporte = await upsertCategory({ 
    name: 'Solicitud o Requerimiento', 
    description: 'Solicitudes y requerimientos de soporte técnico', 
    level: 1, 
    parentId: null, 
    departmentId: deptSoporteId, 
    order: 2, 
    color: '#3B82F6' 
  })

  // Nivel 2 - Soporte Técnico
  const equipos = await upsertCategory({ 
    name: 'Equipos', 
    description: 'Computadoras, laptops, equipos de cómputo', 
    level: 2, 
    parentId: fallaErrorSoporte.id, 
    departmentId: deptSoporteId, 
    order: 1, 
    color: '#10B981' 
  })
  
  const solicitudRequerimientoN2Soporte = await upsertCategory({ 
    name: 'Solicitud o Requerimiento', 
    description: 'Solicitudes generales de soporte', 
    level: 2, 
    parentId: solicitudRequerimientoSoporte.id, 
    departmentId: deptSoporteId, 
    order: 1, 
    color: '#3B82F6' 
  })

  // Nivel 3 - Equipos (Fallas)
  await upsertCategory({ name: 'Verificación de Partes', description: 'Verificación de componentes, hardware', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Preparación Equipos', description: 'Preparación de equipos nuevos', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Revisión Equipos', description: 'Revisión técnica de equipos', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Instalar Software Base', description: 'Instalación de sistema operativo y software base', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Reparación de Equipos', description: 'Reparación de hardware, componentes', level: 3, parentId: equipos.id, departmentId: deptSoporteId, order: 5, color: '#EF4444' })

  // Nivel 3 - Solicitudes Soporte
  await upsertCategory({ name: 'Renovación de Equipo', description: 'Solicitud de renovación de equipo', level: 3, parentId: solicitudRequerimientoN2Soporte.id, departmentId: deptSoporteId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Adquisición Equipos', description: 'Solicitud de compra de equipos', level: 3, parentId: solicitudRequerimientoN2Soporte.id, departmentId: deptSoporteId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Adquisición de Impresoras', description: 'Solicitud de compra de impresoras', level: 3, parentId: solicitudRequerimientoN2Soporte.id, departmentId: deptSoporteId, order: 3, color: '#3B82F6' })


  // ==================== SEGURIDAD DE LA INFORMACIÓN ====================
  
  // Nivel 1 - Seguridad
  const incidentes = await upsertCategory({ 
    name: 'Incidentes', 
    description: 'Incidentes de seguridad de la información', 
    level: 1, 
    parentId: null, 
    departmentId: deptSeguridadId, 
    order: 1, 
    color: '#EF4444' 
  })
  
  const requerimientosSeguridad = await upsertCategory({ 
    name: 'Requerimientos', 
    description: 'Requerimientos de seguridad de la información', 
    level: 1, 
    parentId: null, 
    departmentId: deptSeguridadId, 
    order: 2, 
    color: '#3B82F6' 
  })

  // Nivel 3 - Incidentes (sin nivel 2 intermedio)
  await upsertCategory({ name: 'Divulgación no Autorizada de Información Confidencial', description: 'Fuga de información, datos confidenciales', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Sensibilización y Entrenamiento a Usuarios', description: 'Capacitación en seguridad', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 2, color: '#EF4444' })
  await upsertCategory({ name: 'Sucesivos Intentos Fallidos de Login', description: 'Múltiples intentos de acceso fallidos', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 3, color: '#EF4444' })
  await upsertCategory({ name: 'Ataques Informáticos', description: 'Cyberataques, hacking, malware', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 4, color: '#EF4444' })
  await upsertCategory({ name: 'Accesos o Intentos no Autorizados', description: 'Acceso no autorizado a sistemas', level: 3, parentId: incidentes.id, departmentId: deptSeguridadId, order: 5, color: '#EF4444' })

  // Nivel 3 - Requerimientos Seguridad
  await upsertCategory({ name: 'Informes de Validación de Alta de Cuentas Usuarias', description: 'Validación de nuevas cuentas', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Informes sobre Validación de Baja de Cuentas Usuarias', description: 'Validación de cuentas eliminadas', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Informe sobre Validación de Modificación de Cuentas Usuarias', description: 'Validación de cambios en cuentas', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 3, color: '#3B82F6' })
  await upsertCategory({ name: 'Definición de Políticas de Seguridad de la Información', description: 'Creación de políticas de seguridad', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 4, color: '#3B82F6' })
  await upsertCategory({ name: 'Aprobación del Servicio VPN', description: 'Aprobación de acceso VPN', level: 3, parentId: requerimientosSeguridad.id, departmentId: deptSeguridadId, order: 5, color: '#3B82F6' })


  // ==================== USUARIOS Y PRIVILEGIOS ====================
  
  // Nivel 1 - Usuarios y Privilegios
  const fallaErrorUsuarios = await upsertCategory({ 
    name: 'Falla o Error', 
    description: 'Problemas con usuarios y privilegios', 
    level: 1, 
    parentId: null, 
    departmentId: deptUsuariosId, 
    order: 1, 
    color: '#EF4444' 
  })
  
  const solicitudRequerimientoUsuarios = await upsertCategory({ 
    name: 'Solicitud o Requerimiento', 
    description: 'Solicitudes de usuarios y privilegios', 
    level: 1, 
    parentId: null, 
    departmentId: deptUsuariosId, 
    order: 2, 
    color: '#3B82F6' 
  })

  // Nivel 2 - Usuarios y Privilegios (Fallas)
  const m365Fallas = await upsertCategory({ 
    name: 'Microsoft 365', 
    description: 'Problemas con Office 365, Microsoft 365', 
    level: 2, 
    parentId: fallaErrorUsuarios.id, 
    departmentId: deptUsuariosId, 
    order: 1, 
    color: '#8B5CF6' 
  })

  // Nivel 2 - Usuarios y Privilegios (Solicitudes)
  const m365Solicitudes = await upsertCategory({ 
    name: 'Microsoft 365', 
    description: 'Solicitudes relacionadas con M365', 
    level: 2, 
    parentId: solicitudRequerimientoUsuarios.id, 
    departmentId: deptUsuariosId, 
    order: 1, 
    color: '#8B5CF6' 
  })
  
  const vpnUsuarios = await upsertCategory({ 
    name: 'VPN', 
    description: 'Solicitudes de VPN, acceso remoto', 
    level: 2, 
    parentId: solicitudRequerimientoUsuarios.id, 
    departmentId: deptUsuariosId, 
    order: 2, 
    color: '#10B981' 
  })

  // Nivel 3 - M365 Fallas
  await upsertCategory({ name: 'Error al Iniciar Sesión en M365', description: 'No puede iniciar sesión en Microsoft 365', level: 3, parentId: m365Fallas.id, departmentId: deptUsuariosId, order: 1, color: '#EF4444' })
  await upsertCategory({ name: 'Servicio no Disponible en M365', description: 'Servicio M365 caído, no disponible', level: 3, parentId: m365Fallas.id, departmentId: deptUsuariosId, order: 2, color: '#EF4444' })

  // Nivel 3 - M365 Solicitudes
  await upsertCategory({ name: 'Cambio de Contraseña Correo', description: 'Solicitud de cambio de contraseña de correo', level: 3, parentId: m365Solicitudes.id, departmentId: deptUsuariosId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Creación de Usuario M365', description: 'Solicitud de nuevo usuario en M365', level: 3, parentId: m365Solicitudes.id, departmentId: deptUsuariosId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Desactivación de Usuarios en M365', description: 'Solicitud de desactivar usuario M365', level: 3, parentId: m365Solicitudes.id, departmentId: deptUsuariosId, order: 3, color: '#3B82F6' })

  // Nivel 3 - VPN Solicitudes
  await upsertCategory({ name: 'Creación de Usuario VPN', description: 'Solicitud de nuevo usuario VPN', level: 3, parentId: vpnUsuarios.id, departmentId: deptUsuariosId, order: 1, color: '#3B82F6' })
  await upsertCategory({ name: 'Baja de Usuario VPN', description: 'Solicitud de eliminar usuario VPN', level: 3, parentId: vpnUsuarios.id, departmentId: deptUsuariosId, order: 2, color: '#3B82F6' })
  await upsertCategory({ name: 'Modificación Perfil y Privilegios Acceso VPN', description: 'Cambio de permisos VPN', level: 3, parentId: vpnUsuarios.id, departmentId: deptUsuariosId, order: 3, color: '#3B82F6' })


  // ==================== TELEFONÍA ====================
  
  // Nivel 1 - Telefonía
  const fallaErrorTelefonia = await upsertCategory({ 
    name: 'Falla o Error', 
    description: 'Problemas con telefonía', 
    level: 1, 
    parentId: null, 
    departmentId: deptTelefoniaId, 
    order: 1, 
    color: '#EF4444' 
  })
  
  const solicitudRequerimientoTelefonia = await upsertCategory({ 
    name: 'Solicitud o Requerimiento', 
    description: 'Solicitudes de telefonía', 
    level: 1, 
    parentId: null, 
    departmentId: deptTelefoniaId, 
    order: 2, 
    color: '#3B82F6' 
  })

  // Nivel 2 - Telefonía (Fallas)
  const dañoBocina = await upsertCategory({ 
    name: 'Daño de Bocina', 
    description: 'Bocina del teléfono dañada', 
    level: 2, 
    parentId: fallaErrorTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 1, 
    color: '#EF4444' 
  })
  
  const dañoExtension = await upsertCategory({ 
    name: 'Daño de Extensión', 
    description: 'Extensión telefónica dañada', 
    level: 2, 
    parentId: fallaErrorTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 2, 
    color: '#EF4444' 
  })
  
  const noFuncionaExtension = await upsertCategory({ 
    name: 'No Funciona la Extensión', 
    description: 'Extensión no funciona', 
    level: 2, 
    parentId: fallaErrorTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 3, 
    color: '#EF4444' 
  })
  
  const problemasLlamadas = await upsertCategory({ 
    name: 'Problemas con Llamadas Entrantes y Salientes', 
    description: 'Problemas con llamadas', 
    level: 2, 
    parentId: fallaErrorTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 4, 
    color: '#EF4444' 
  })
  
  const telefonoSinRed = await upsertCategory({ 
    name: 'Teléfono sin Red', 
    description: 'Teléfono sin conexión de red', 
    level: 2, 
    parentId: fallaErrorTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 5, 
    color: '#EF4444' 
  })

  // Nivel 2 - Telefonía (Solicitudes)
  const cambioExtension = await upsertCategory({ 
    name: 'Cambio de Extensión', 
    description: 'Solicitud de cambio de extensión', 
    level: 2, 
    parentId: solicitudRequerimientoTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 1, 
    color: '#3B82F6' 
  })
  
  const solicitudExtension = await upsertCategory({ 
    name: 'Solicitud de Extensión', 
    description: 'Solicitud de nueva extensión', 
    level: 2, 
    parentId: solicitudRequerimientoTelefonia.id, 
    departmentId: deptTelefoniaId, 
    order: 2, 
    color: '#3B82F6' 
  })

  console.log('✅ Categorías desde Excel creadas exitosamente')
  console.log('📊 Total: 5 departamentos con jerarquía N1 → N2 → N3')
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

async function seedLicenseTypes() {
  const types = [
    { code: 'WINDOWS', name: 'Windows', icon: 'Monitor', order: 1 },
    { code: 'OFFICE_365', name: 'Office 365', icon: 'FileText', order: 2 },
    { code: 'ANTIVIRUS', name: 'Antivirus', icon: 'Shield', order: 3 },
    { code: 'ADOBE', name: 'Adobe', icon: 'Palette', order: 4 },
    { code: 'AUTOCAD', name: 'AutoCAD', icon: 'PenTool', order: 5 },
    { code: 'GOOGLE_WORKSPACE', name: 'Google Workspace', icon: 'Cloud', order: 6 },
    { code: 'SLACK', name: 'Slack', icon: 'MessageSquare', order: 7 },
    { code: 'ZOOM', name: 'Zoom', icon: 'Video', order: 8 },
    { code: 'JIRA', name: 'Jira', icon: 'Trello', order: 9 },
    { code: 'GITHUB', name: 'GitHub', icon: 'Github', order: 10 },
    { code: 'SAAS', name: 'SaaS (Otro)', icon: 'Globe', order: 11 },
    { code: 'PERPETUAL', name: 'Licencia Perpetua', icon: 'Key', order: 12 },
    { code: 'SUBSCRIPTION', name: 'Suscripción', icon: 'RefreshCw', order: 13 },
    { code: 'OEM', name: 'OEM', icon: 'Cpu', order: 14 },
    { code: 'OTHER', name: 'Otro', icon: 'Box', order: 15 },
  ]
  for (const t of types) {
    await prisma.license_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order },
      create: { id: randomUUID(), ...t, isActive: true, createdAt: now, updatedAt: now },
    })
  }
  console.log(`✅ ${types.length} tipos de licencia`)
}

async function seedConsumableTypes() {
  const types = [
    { code: 'TONER', name: 'Tóner', icon: 'Printer', order: 1 },
    { code: 'INK', name: 'Tinta', icon: 'Droplet', order: 2 },
    { code: 'PAPER', name: 'Papel', icon: 'FileText', order: 3 },
    { code: 'CABLE', name: 'Cable', icon: 'Cable', order: 4 },
    { code: 'BATTERY', name: 'Batería', icon: 'Battery', order: 5 },
    { code: 'CLEANING', name: 'Limpieza', icon: 'Sparkles', order: 6 },
    { code: 'ADAPTER', name: 'Adaptador', icon: 'Plug', order: 7 },
    { code: 'STORAGE', name: 'Almacenamiento', icon: 'HardDrive', order: 8 },
    { code: 'PERIPHERAL', name: 'Periférico', icon: 'Mouse', order: 9 },
    { code: 'TOOL', name: 'Herramienta', icon: 'Wrench', order: 10 },
    { code: 'OTHER', name: 'Otro', icon: 'Box', order: 99 },
  ]
  for (const t of types) {
    await prisma.consumable_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order },
      create: { id: randomUUID(), ...t, isActive: true, createdAt: now, updatedAt: now },
    })
  }
  console.log(`✅ ${types.length} tipos de consumible`)
}

async function seedUnitsOfMeasure() {
  const units = [
    { code: 'UNIT', name: 'Unidad', symbol: 'ud', order: 1 },
    { code: 'BOX', name: 'Caja', symbol: 'caja', order: 2 },
    { code: 'PACK', name: 'Paquete', symbol: 'paq', order: 3 },
    { code: 'REAM', name: 'Resma', symbol: 'resma', order: 4 },
    { code: 'ROLL', name: 'Rollo', symbol: 'rollo', order: 5 },
    { code: 'METER', name: 'Metro', symbol: 'm', order: 6 },
    { code: 'LITER', name: 'Litro', symbol: 'L', order: 7 },
    { code: 'KG', name: 'Kilogramo', symbol: 'kg', order: 8 },
    { code: 'SET', name: 'Juego', symbol: 'juego', order: 9 },
    { code: 'PAIR', name: 'Par', symbol: 'par', order: 10 },
  ]
  for (const u of units) {
    await prisma.units_of_measure.upsert({
      where: { code: u.code },
      update: { name: u.name, symbol: u.symbol, order: u.order },
      create: { id: randomUUID(), ...u, isActive: true, createdAt: now, updatedAt: now },
    })
  }
  console.log(`✅ ${units.length} unidades de medida`)
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

async function seedInventoryFamilies() {
  const families = [
    { code: 'FIXED_ASSETS',   name: 'Activos Fijos e Infraestructura',        icon: 'building-2',  color: '#1D4ED8', order: 1 },
    { code: 'MAINTENANCE',    name: 'Repuestos y Materiales de Mantenimiento', icon: 'wrench',       color: '#B45309', order: 2 },
    { code: 'SERVICES',       name: 'Servicios de Operación y Limpieza',       icon: 'sparkles',     color: '#059669', order: 3 },
    { code: 'SECURITY',       name: 'Seguridad y Protección',                  icon: 'shield',       color: '#DC2626', order: 4 },
    { code: 'TECHNOLOGY',     name: 'Tecnología y Comunicaciones',             icon: 'monitor',      color: '#7C3AED', order: 5 },
    { code: 'GREEN_AREAS',    name: 'Áreas Verdes y Exteriores',               icon: 'tree-pine',    color: '#16A34A', order: 6 },
    { code: 'ADMINISTRATIVE', name: 'Gestión Administrativa y Documental',     icon: 'folder-open',  color: '#0891B2', order: 7 },
    { code: 'COMMERCIAL',     name: 'Activos de Gestión Comercial',            icon: 'store',        color: '#EA580C', order: 8 },
  ]
  for (const f of families) {
    await prisma.inventory_families.upsert({
      where: { code: f.code },
      update: { name: f.name, icon: f.icon, color: f.color, order: f.order },
      create: { id: randomUUID(), ...f, isActive: true },
    })
  }
  console.log(`✅ ${families.length} familias de inventario`)
}

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

async function migrateExistingTypesToTechnology() {
  const techFamily = await prisma.inventory_families.findUnique({ where: { code: 'TECHNOLOGY' } })
  if (techFamily) {
    const [eq, co, li] = await Promise.all([
      prisma.equipment_types.updateMany({ where: { familyId: null }, data: { familyId: techFamily.id } }),
      prisma.consumable_types.updateMany({ where: { familyId: null }, data: { familyId: techFamily.id } }),
      prisma.license_types.updateMany({ where: { familyId: null }, data: { familyId: techFamily.id } }),
    ])
    console.log(`✅ Migración conservadora: ${eq.count} tipos de equipo, ${co.count} tipos de consumible, ${li.count} tipos de licencia → TECHNOLOGY`)
  }
}

main()
  .catch(e => { console.error('❌ Error durante el seed:', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
