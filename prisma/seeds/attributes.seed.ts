import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Seed de atributos para tipos de inventario
 * Crea atributos de ejemplo para equipment_types, license_types y consumable_types
 */
export async function seedAttributes(prisma: PrismaClient, familyMap: Map<string, string>) {
  console.log('🔧 Seeding atributos de tipos de inventario...')

  const techFamilyId = familyMap.get('TECHNOLOGY')!

  // ============================================
  // ATRIBUTOS PARA EQUIPMENT TYPES
  // ============================================

  // Obtener tipos de equipo existentes
  const computerType = await prisma.equipment_types.findFirst({
    where: { name: 'Computadora de Escritorio', familyId: techFamilyId },
  })
  const laptopType = await prisma.equipment_types.findFirst({
    where: { name: 'Laptop', familyId: techFamilyId },
  })
  const printerType = await prisma.equipment_types.findFirst({
    where: { name: 'Impresora', familyId: techFamilyId },
  })

  // Atributos para Computadora de Escritorio
  if (computerType) {
    const computerAttrs = [
      {
        attributeName: 'processor',
        attributeLabel: 'Procesador',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Intel Core i7-12700',
      },
      {
        attributeName: 'ram',
        attributeLabel: 'RAM',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: 16GB DDR4',
      },
      {
        attributeName: 'storage',
        attributeLabel: 'Almacenamiento',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 3,
        helpText: 'Ej: 512GB SSD',
      },
      {
        attributeName: 'gpu',
        attributeLabel: 'Tarjeta Gráfica',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 4,
        helpText: 'Ej: NVIDIA GTX 1650',
      },
      {
        attributeName: 'os',
        attributeLabel: 'Sistema Operativo',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 5,
        options: ['Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu 22.04', 'macOS'],
      },
    ]

    for (const attr of computerAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: computerType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          equipmentTypeId: computerType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${computerAttrs.length} atributos para Computadora de Escritorio`)
  }

  // Atributos para Laptop
  if (laptopType) {
    const laptopAttrs = [
      {
        attributeName: 'processor',
        attributeLabel: 'Procesador',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Intel Core i5-1235U',
      },
      {
        attributeName: 'ram',
        attributeLabel: 'RAM',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: 8GB DDR4',
      },
      {
        attributeName: 'storage',
        attributeLabel: 'Almacenamiento',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 3,
        helpText: 'Ej: 256GB SSD',
      },
      {
        attributeName: 'screen_size',
        attributeLabel: 'Tamaño de Pantalla',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 4,
        options: ['13.3"', '14"', '15.6"', '17"'],
      },
    ]

    for (const attr of laptopAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: laptopType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          equipmentTypeId: laptopType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${laptopAttrs.length} atributos para Laptop`)
  }

  // Atributos para Impresora
  if (printerType) {
    const printerAttrs = [
      {
        attributeName: 'printer_type',
        attributeLabel: 'Tipo de Impresora',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['Láser', 'Inyección de Tinta', 'Multifuncional', 'Térmica'],
      },
      {
        attributeName: 'color',
        attributeLabel: 'Color',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['Monocromática', 'Color'],
      },
      {
        attributeName: 'connectivity',
        attributeLabel: 'Conectividad',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 3,
        options: ['USB', 'Red (Ethernet)', 'WiFi', 'USB + Red', 'USB + WiFi'],
      },
    ]

    for (const attr of printerAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: printerType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          equipmentTypeId: printerType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${printerAttrs.length} atributos para Impresora`)
  }

  // ============================================
  // ATRIBUTOS PARA LICENSE TYPES
  // ============================================

  const officeType = await prisma.license_types.findFirst({
    where: { name: 'Microsoft Office 365', familyId: techFamilyId },
  })
  const antivirusType = await prisma.license_types.findFirst({
    where: { name: 'Antivirus', familyId: techFamilyId },
  })

  // Atributos para Microsoft Office 365
  if (officeType) {
    const officeAttrs = [
      {
        attributeName: 'plan',
        attributeLabel: 'Plan',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['Business Basic', 'Business Standard', 'Business Premium', 'E3', 'E5'],
      },
      {
        attributeName: 'user_count',
        attributeLabel: 'Número de Usuarios',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Cantidad de licencias',
      },
    ]

    for (const attr of officeAttrs) {
      await prisma.license_type_attributes.upsert({
        where: {
          licenseTypeId_attributeName: {
            licenseTypeId: officeType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          licenseTypeId: officeType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${officeAttrs.length} atributos para Microsoft Office 365`)
  }

  // Atributos para Antivirus
  if (antivirusType) {
    const antivirusAttrs = [
      {
        attributeName: 'vendor',
        attributeLabel: 'Proveedor',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['Kaspersky', 'Norton', 'McAfee', 'Bitdefender', 'ESET', 'Trend Micro'],
      },
      {
        attributeName: 'protection_type',
        attributeLabel: 'Tipo de Protección',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['Endpoint', 'Server', 'Cloud', 'Total Security'],
      },
      {
        attributeName: 'device_count',
        attributeLabel: 'Número de Dispositivos',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 3,
        helpText: 'Cantidad de dispositivos protegidos',
      },
    ]

    for (const attr of antivirusAttrs) {
      await prisma.license_type_attributes.upsert({
        where: {
          licenseTypeId_attributeName: {
            licenseTypeId: antivirusType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          licenseTypeId: antivirusType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${antivirusAttrs.length} atributos para Antivirus`)
  }

  // ============================================
  // ATRIBUTOS PARA CONSUMABLE TYPES
  // ============================================

  const tonerType = await prisma.consumable_types.findFirst({
    where: { name: 'Tóner', familyId: techFamilyId },
  })
  const paperType = await prisma.consumable_types.findFirst({
    where: { name: 'Papel', familyId: techFamilyId },
  })

  // Atributos para Tóner
  if (tonerType) {
    const tonerAttrs = [
      {
        attributeName: 'color',
        attributeLabel: 'Color',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['Negro', 'Cyan', 'Magenta', 'Amarillo'],
      },
      {
        attributeName: 'compatible_model',
        attributeLabel: 'Modelo Compatible',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: HP CF410A',
      },
      {
        attributeName: 'unit',
        attributeLabel: 'Unidad de Medida',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 3,
        options: ['Unidad', 'Caja', 'Paquete'],
      },
    ]

    for (const attr of tonerAttrs) {
      await prisma.consumable_type_attributes.upsert({
        where: {
          consumableTypeId_attributeName: {
            consumableTypeId: tonerType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          consumableTypeId: tonerType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${tonerAttrs.length} atributos para Tóner`)
  }

  // Atributos para Papel
  if (paperType) {
    const paperAttrs = [
      {
        attributeName: 'size',
        attributeLabel: 'Tamaño',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['A4', 'Carta', 'Oficio', 'A3'],
      },
      {
        attributeName: 'weight',
        attributeLabel: 'Gramaje',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['75g/m²', '80g/m²', '90g/m²', '100g/m²'],
      },
      {
        attributeName: 'color',
        attributeLabel: 'Color',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 3,
        options: ['Blanco', 'Amarillo', 'Azul', 'Verde', 'Rosa'],
      },
      {
        attributeName: 'unit',
        attributeLabel: 'Unidad de Medida',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 4,
        options: ['Resma', 'Caja', 'Paquete'],
      },
    ]

    for (const attr of paperAttrs) {
      await prisma.consumable_type_attributes.upsert({
        where: {
          consumableTypeId_attributeName: {
            consumableTypeId: paperType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {},
        create: {
          id: randomUUID(),
          consumableTypeId: paperType.id,
          ...attr,
        },
      })
    }
    console.log(`  ✅ ${paperAttrs.length} atributos para Papel`)
  }

  console.log('✅ Seed de atributos completado')
}
