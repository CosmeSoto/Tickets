/**
 * Seed: Inventory Types (Tipos de Inventario)
 *
 * Crea los tipos de inventario para diferentes familias:
 * - Tipos de Equipo: laptops, desktops, impresoras, cámaras, herramientas, etc.
 * - Tipos de Licencia: Windows, Office 365, contratos, seguros, etc.
 * - Tipos de Consumible: tóner, papel, repuestos, productos de limpieza, etc.
 */

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

export async function seedEquipmentTypes(prisma: PrismaClient, familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const types = [
    // ADMINISTRATIVE (TI)
    { code: 'LAPTOP', name: 'Laptop', icon: 'Laptop', order: 1, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'DESKTOP',
      name: 'Desktop',
      icon: 'Monitor',
      order: 2,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'MONITOR',
      name: 'Monitor',
      icon: 'Monitor',
      order: 3,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'PRINTER',
      name: 'Impresora',
      icon: 'Printer',
      order: 4,
      familyId: fam('ADMINISTRATIVE'),
    },
    { code: 'PHONE', name: 'Teléfono', icon: 'Phone', order: 5, familyId: fam('ADMINISTRATIVE') },
    { code: 'TABLET', name: 'Tablet', icon: 'Tablet', order: 6, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'KEYBOARD',
      name: 'Teclado',
      icon: 'Keyboard',
      order: 7,
      familyId: fam('ADMINISTRATIVE'),
    },
    { code: 'MOUSE', name: 'Mouse', icon: 'Mouse', order: 8, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'HEADSET',
      name: 'Audífonos',
      icon: 'Headphones',
      order: 9,
      familyId: fam('ADMINISTRATIVE'),
    },
    { code: 'WEBCAM', name: 'Webcam', icon: 'Camera', order: 10, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'DOCKING_STATION',
      name: 'Docking Station',
      icon: 'Cpu',
      order: 11,
      familyId: fam('ADMINISTRATIVE'),
    },
    { code: 'UPS', name: 'UPS', icon: 'Battery', order: 12, familyId: fam('ADMINISTRATIVE') },
    { code: 'ROUTER', name: 'Router', icon: 'Router', order: 13, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'SWITCH',
      name: 'Switch de Red',
      icon: 'Wifi',
      order: 14,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'SERVER',
      name: 'Servidor',
      icon: 'Server',
      order: 15,
      familyId: fam('ADMINISTRATIVE'),
    },
    // ARCHITECTURE
    {
      code: 'AC_UNIT',
      name: 'Aire Acondicionado',
      icon: 'Wind',
      order: 20,
      familyId: fam('ARCHITECTURE'),
    },
    { code: 'GENERATOR', name: 'Generador', icon: 'Zap', order: 21, familyId: fam('ARCHITECTURE') },
    {
      code: 'ELEVATOR',
      name: 'Ascensor',
      icon: 'Building2',
      order: 22,
      familyId: fam('ARCHITECTURE'),
    },
    {
      code: 'WATER_PUMP',
      name: 'Bomba de Agua',
      icon: 'Droplets',
      order: 23,
      familyId: fam('ARCHITECTURE'),
    },
    {
      code: 'COMPRESSOR',
      name: 'Compresor',
      icon: 'Gauge',
      order: 24,
      familyId: fam('ARCHITECTURE'),
    },
    // OPERATIONS — equipos de seguridad
    {
      code: 'IP_CAMERA',
      name: 'Cámara IP',
      icon: 'Camera',
      order: 30,
      familyId: fam('OPERATIONS'),
    },
    { code: 'DVR_NVR', name: 'DVR/NVR', icon: 'HardDrive', order: 31, familyId: fam('OPERATIONS') },
    {
      code: 'ACCESS_CONTROL',
      name: 'Control de Acceso',
      icon: 'Fingerprint',
      order: 32,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'ALARM_PANEL',
      name: 'Panel de Alarma',
      icon: 'AlertTriangle',
      order: 33,
      familyId: fam('OPERATIONS'),
    },
    // OPERATIONS — mantenimiento
    {
      code: 'POWER_TOOL',
      name: 'Herramienta Eléctrica',
      icon: 'Zap',
      order: 40,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'HAND_TOOL',
      name: 'Herramienta Manual',
      icon: 'Wrench',
      order: 41,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'MEASURING_TOOL',
      name: 'Equipo de Medición',
      icon: 'Ruler',
      order: 42,
      familyId: fam('OPERATIONS'),
    },
    // OPERATIONS — servicios generales
    {
      code: 'CLEANING_MACHINE',
      name: 'Equipo de Limpieza',
      icon: 'Sparkles',
      order: 50,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'COFFEE_MACHINE',
      name: 'Máquina de Café',
      icon: 'Coffee',
      order: 51,
      familyId: fam('OPERATIONS'),
    },
    // COMMERCIAL
    {
      code: 'POS_TERMINAL',
      name: 'Terminal POS',
      icon: 'CreditCard',
      order: 60,
      familyId: fam('COMMERCIAL'),
    },
    {
      code: 'CASH_REGISTER',
      name: 'Caja Registradora',
      icon: 'DollarSign',
      order: 61,
      familyId: fam('COMMERCIAL'),
    },
    {
      code: 'BARCODE_READER',
      name: 'Lector de Código de Barras',
      icon: 'Tag',
      order: 62,
      familyId: fam('COMMERCIAL'),
    },
    // General
    { code: 'OTHER', name: 'Otro', icon: 'Box', order: 99, familyId: fam('ADMINISTRATIVE') },
  ]

  for (const t of types) {
    await prisma.equipment_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order, familyId: t.familyId },
      create: { id: randomUUID(), ...t, isActive: true },
    })
  }
  console.log(`  ✓ ${types.length} tipos de equipo`)
}

export async function seedLicenseTypes(prisma: PrismaClient, familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const types = [
    {
      code: 'WINDOWS',
      name: 'Windows',
      icon: 'Monitor',
      order: 1,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'OFFICE_365',
      name: 'Office 365',
      icon: 'FileText',
      order: 2,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'ANTIVIRUS',
      name: 'Antivirus',
      icon: 'Shield',
      order: 3,
      familyId: fam('ADMINISTRATIVE'),
    },
    { code: 'ADOBE', name: 'Adobe', icon: 'Paintbrush', order: 4, familyId: fam('ADMINISTRATIVE') },
    { code: 'AUTOCAD', name: 'AutoCAD', icon: 'Ruler', order: 5, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'GOOGLE_WORKSPACE',
      name: 'Google Workspace',
      icon: 'Cloud',
      order: 6,
      familyId: fam('ADMINISTRATIVE'),
    },
    { code: 'SAAS', name: 'SaaS (Otro)', icon: 'Globe', order: 7, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'SUBSCRIPTION',
      name: 'Suscripción',
      icon: 'RefreshCw',
      order: 8,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'PERPETUAL',
      name: 'Licencia Perpetua',
      icon: 'Key',
      order: 9,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'MAINTENANCE_CONTRACT',
      name: 'Contrato de Mantenimiento',
      icon: 'Wrench',
      order: 20,
      familyId: fam('ARCHITECTURE'),
    },
    {
      code: 'SERVICE_CONTRACT',
      name: 'Contrato de Servicio',
      icon: 'ClipboardList',
      order: 21,
      familyId: fam('ARCHITECTURE'),
    },
    {
      code: 'ASSET_INSURANCE',
      name: 'Seguro de Activos',
      icon: 'ShieldCheck',
      order: 22,
      familyId: fam('ARCHITECTURE'),
    },
    {
      code: 'CLEANING_CONTRACT',
      name: 'Contrato de Limpieza',
      icon: 'Sparkles',
      order: 30,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'SECURITY_CONTRACT',
      name: 'Contrato de Seguridad',
      icon: 'Shield',
      order: 31,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'POS_LICENSE',
      name: 'Licencia Software POS',
      icon: 'CreditCard',
      order: 40,
      familyId: fam('COMMERCIAL'),
    },
    { code: 'OTHER', name: 'Otro', icon: 'Box', order: 99, familyId: fam('ADMINISTRATIVE') },
  ]

  for (const t of types) {
    await prisma.license_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order, familyId: t.familyId },
      create: { id: randomUUID(), ...t, isActive: true },
    })
  }
  console.log(`  ✓ ${types.length} tipos de licencia`)
}

export async function seedConsumableTypes(prisma: PrismaClient, familyMap: Map<string, string>) {
  const fam = (code: string) => familyMap.get(code)!
  const types = [
    { code: 'TONER', name: 'Tóner', icon: 'Printer', order: 1, familyId: fam('ADMINISTRATIVE') },
    { code: 'INK', name: 'Tinta', icon: 'Droplets', order: 2, familyId: fam('ADMINISTRATIVE') },
    { code: 'PAPER', name: 'Papel', icon: 'FileText', order: 3, familyId: fam('ADMINISTRATIVE') },
    { code: 'CABLE', name: 'Cable', icon: 'Cable', order: 4, familyId: fam('ADMINISTRATIVE') },
    {
      code: 'BATTERY',
      name: 'Batería',
      icon: 'Battery',
      order: 5,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'STORAGE',
      name: 'Almacenamiento',
      icon: 'HardDrive',
      order: 6,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'BEVERAGE',
      name: 'Bebidas',
      icon: 'Droplets',
      order: 7,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'WATER_JUG',
      name: 'Botellón de agua',
      icon: 'Droplets',
      order: 8,
      familyId: fam('ADMINISTRATIVE'),
    },
    {
      code: 'SPARE_PART',
      name: 'Repuesto Mecánico',
      icon: 'Wrench',
      order: 10,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'LUBRICANT',
      name: 'Lubricante',
      icon: 'Droplets',
      order: 11,
      familyId: fam('OPERATIONS'),
    },
    { code: 'FILTER', name: 'Filtro', icon: 'Settings', order: 12, familyId: fam('OPERATIONS') },
    { code: 'TOOL', name: 'Herramienta', icon: 'Wrench', order: 13, familyId: fam('OPERATIONS') },
    {
      code: 'CLEANING',
      name: 'Producto de Limpieza',
      icon: 'Sparkles',
      order: 20,
      familyId: fam('OPERATIONS'),
    },
    { code: 'HYGIENE', name: 'Higiene', icon: 'Sparkles', order: 21, familyId: fam('OPERATIONS') },
    {
      code: 'SECURITY_BATTERY',
      name: 'Batería de Respaldo',
      icon: 'Battery',
      order: 30,
      familyId: fam('OPERATIONS'),
    },
    {
      code: 'FERTILIZER',
      name: 'Fertilizante',
      icon: 'Leaf',
      order: 40,
      familyId: fam('OPERATIONS'),
    },
    { code: 'PESTICIDE', name: 'Pesticida', icon: 'Leaf', order: 41, familyId: fam('OPERATIONS') },
    { code: 'SEED', name: 'Semilla', icon: 'Flower2', order: 42, familyId: fam('OPERATIONS') },
    { code: 'OTHER', name: 'Otro', icon: 'Box', order: 99, familyId: fam('ADMINISTRATIVE') },
  ]

  for (const t of types) {
    await prisma.consumable_types.upsert({
      where: { code: t.code },
      update: { name: t.name, icon: t.icon, order: t.order, familyId: t.familyId },
      create: { id: randomUUID(), ...t, isActive: true },
    })
  }
  console.log(`  ✓ ${types.length} tipos de consumible`)
}

export async function seedInventoryTypes(prisma: PrismaClient, familyMap: Map<string, string>) {
  console.log('📦 Creando tipos de inventario...')
  await seedEquipmentTypes(prisma, familyMap)
  await seedCommonEquipmentTypesForAllFamilies(prisma, familyMap)
  await seedLicenseTypes(prisma, familyMap)
  await seedConsumableTypes(prisma, familyMap)
  console.log('✅ Tipos de inventario creados')
}

/**
 * Crea tipos de equipo comunes (Laptop, Desktop, Monitor) en todas las familias
 * que no sean ADMINISTRATIVE (que ya los tiene). Esto permite a Compras registrar
 * equipos informáticos para cualquier familia.
 */
async function seedCommonEquipmentTypesForAllFamilies(
  prisma: PrismaClient,
  familyMap: Map<string, string>
) {
  const commonTypes = [
    { code: 'LAPTOP', name: 'Laptop', icon: 'Laptop', order: 50 },
    { code: 'DESKTOP', name: 'Desktop', icon: 'Monitor', order: 51 },
    { code: 'MONITOR', name: 'Monitor', icon: 'Monitor', order: 52 },
    { code: 'PRINTER', name: 'Impresora', icon: 'Printer', order: 53 },
    { code: 'PHONE', name: 'Teléfono', icon: 'Phone', order: 54 },
  ]

  // Familias donde clonar tipos comunes (ADMINISTRATIVE ya tiene códigos canónicos)
  const targetFamilies = ['ARCHITECTURE', 'OPERATIONS', 'COMMERCIAL', 'MARKETING']
  let created = 0

  for (const familyCode of targetFamilies) {
    const familyId = familyMap.get(familyCode)
    if (!familyId) continue

    for (const type of commonTypes) {
      const uniqueCode = `${type.code}_${familyCode}`
      const existing = await prisma.equipment_types.findFirst({
        where: { OR: [{ code: uniqueCode }, { name: type.name, familyId }] },
      })
      if (!existing) {
        await prisma.equipment_types.create({
          data: {
            id: randomUUID(),
            code: uniqueCode,
            name: type.name,
            icon: type.icon,
            order: type.order,
            familyId,
            isActive: true,
          },
        })
        created++
      }
    }
  }

  if (created > 0) {
    console.log(`  ✓ ${created} tipos comunes (Laptop/Desktop/Monitor/Impresora) en otras familias`)
  }
}
