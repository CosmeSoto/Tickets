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
        attributeName: 'marca',
        attributeLabel: 'Marca',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Dell, HP, Lenovo',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: OptiPlex 7090',
      },
      // {
      //   attributeName: 'numero_serie',
      //   attributeLabel: 'Número de Serie',
      //   attributeType: 'text',
      //   isRequired: false,
      //   isVisible: true,
      //   order: 3,
      //   helpText: 'Número de serie del fabricante',
      // },
      {
        attributeName: 'procesador',
        attributeLabel: 'Procesador',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 4,
        helpText: 'Ej: Intel Core i7-12700',
      },
      {
        attributeName: 'ram',
        attributeLabel: 'RAM (GB)',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 5,
        helpText: 'Ej: 16',
      },
      {
        attributeName: 'almacenamiento',
        attributeLabel: 'Almacenamiento (GB)',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 6,
        helpText: 'Ej: 512',
      },
      {
        attributeName: 'tipo_disco',
        attributeLabel: 'Tipo de Disco',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 7,
        options: ['SSD', 'HDD', 'SSD + HDD', 'NVMe'],
      },
      {
        attributeName: 'sistema_operativo',
        attributeLabel: 'Sistema Operativo',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 8,
        options: ['Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu 22.04', 'macOS'],
      },
      {
        attributeName: 'tarjeta_grafica',
        attributeLabel: 'Tarjeta Gráfica',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 9,
        helpText: 'Ej: NVIDIA GTX 1650',
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: computerType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${computerAttrs.length} atributos para Computadora de Escritorio`)
  }

  // Atributos para Laptop
  if (laptopType) {
    const laptopAttrs = [
      {
        attributeName: 'marca',
        attributeLabel: 'Marca',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Dell, HP, Lenovo',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: Latitude 5420',
      },
      {
        attributeName: 'numero_serie',
        attributeLabel: 'Número de Serie',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
        helpText: 'Número de serie del fabricante',
      },
      {
        attributeName: 'procesador',
        attributeLabel: 'Procesador',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 4,
        helpText: 'Ej: Intel Core i5-1235U',
      },
      {
        attributeName: 'ram',
        attributeLabel: 'RAM (GB)',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 5,
        helpText: 'Ej: 8',
      },
      {
        attributeName: 'almacenamiento',
        attributeLabel: 'Almacenamiento (GB)',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 6,
        helpText: 'Ej: 256',
      },
      {
        attributeName: 'tipo_disco',
        attributeLabel: 'Tipo de Disco',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 7,
        options: ['SSD', 'HDD', 'NVMe'],
      },
      {
        attributeName: 'sistema_operativo',
        attributeLabel: 'Sistema Operativo',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 8,
        options: ['Windows 11 Pro', 'Windows 10 Pro', 'Ubuntu 22.04', 'macOS'],
      },
      {
        attributeName: 'pantalla_pulgadas',
        attributeLabel: 'Tamaño Pantalla (pulgadas)',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 9,
        options: ['13.3', '14', '15.6', '17'],
      },
      {
        attributeName: 'resolucion',
        attributeLabel: 'Resolución',
        attributeType: 'select',
        isRequired: false,
        isVisible: true,
        order: 10,
        options: ['1366x768', '1920x1080', '2560x1440', '3840x2160'],
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: laptopType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${laptopAttrs.length} atributos para Laptop`)
  }

  // Atributos para Impresora
  if (printerType) {
    const printerAttrs = [
      {
        attributeName: 'marca',
        attributeLabel: 'Marca',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: HP, Canon, Epson',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: LaserJet Pro M404dn',
      },
      {
        attributeName: 'numero_serie',
        attributeLabel: 'Número de Serie',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
        helpText: 'Número de serie del fabricante',
      },
      {
        attributeName: 'tipo_impresora',
        attributeLabel: 'Tipo de Impresora',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 4,
        options: ['Láser', 'Inyección de Tinta', 'Multifuncional', 'Térmica'],
      },
      {
        attributeName: 'color',
        attributeLabel: 'Color',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 5,
        options: ['Monocromática', 'Color'],
      },
      {
        attributeName: 'conectividad',
        attributeLabel: 'Conectividad',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 6,
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: printerType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${printerAttrs.length} atributos para Impresora`)
  }

  // ============================================
  // ATRIBUTOS PARA LICENSE TYPES
  // ============================================

  const officeType = await prisma.license_types.findFirst({
    where: { name: 'Office 365', familyId: techFamilyId },
  })
  const antivirusType = await prisma.license_types.findFirst({
    where: { name: 'Antivirus', familyId: techFamilyId },
  })
  const windowsType = await prisma.license_types.findFirst({
    where: { name: 'Windows', familyId: techFamilyId },
  })
  const adobeType = await prisma.license_types.findFirst({
    where: { name: 'Adobe', familyId: techFamilyId },
  })

  // Atributos para Office 365
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
        attributeName: 'numero_usuarios',
        attributeLabel: 'Número de Usuarios',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Cantidad de licencias',
      },
      {
        attributeName: 'tipo_suscripcion',
        attributeLabel: 'Tipo de Suscripción',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 3,
        options: ['Mensual', 'Anual'],
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          licenseTypeId: officeType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${officeAttrs.length} atributos para Office 365`)
  }

  // Atributos para Windows
  if (windowsType) {
    const windowsAttrs = [
      {
        attributeName: 'version',
        attributeLabel: 'Versión',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: [
          'Windows 11 Pro',
          'Windows 11 Enterprise',
          'Windows 10 Pro',
          'Windows 10 Enterprise',
          'Windows Server 2022',
          'Windows Server 2019',
        ],
      },
      {
        attributeName: 'tipo_licencia',
        attributeLabel: 'Tipo de Licencia',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['OEM', 'Retail', 'Volumen', 'Suscripción'],
      },
      {
        attributeName: 'numero_dispositivos',
        attributeLabel: 'Número de Dispositivos',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 3,
        helpText: 'Cantidad de dispositivos',
      },
    ]

    for (const attr of windowsAttrs) {
      await prisma.license_type_attributes.upsert({
        where: {
          licenseTypeId_attributeName: {
            licenseTypeId: windowsType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          licenseTypeId: windowsType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${windowsAttrs.length} atributos para Windows`)
  }

  // Atributos para Adobe
  if (adobeType) {
    const adobeAttrs = [
      {
        attributeName: 'producto',
        attributeLabel: 'Producto',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: [
          'Creative Cloud All Apps',
          'Photoshop',
          'Illustrator',
          'InDesign',
          'Premiere Pro',
          'After Effects',
          'Acrobat Pro',
        ],
      },
      {
        attributeName: 'tipo_plan',
        attributeLabel: 'Tipo de Plan',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['Individual', 'Equipo', 'Empresarial'],
      },
      {
        attributeName: 'numero_usuarios',
        attributeLabel: 'Número de Usuarios',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 3,
        helpText: 'Cantidad de licencias',
      },
    ]

    for (const attr of adobeAttrs) {
      await prisma.license_type_attributes.upsert({
        where: {
          licenseTypeId_attributeName: {
            licenseTypeId: adobeType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          licenseTypeId: adobeType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${adobeAttrs.length} atributos para Adobe`)
  }

  // Atributos para Antivirus
  if (antivirusType) {
    const antivirusAttrs = [
      {
        attributeName: 'proveedor',
        attributeLabel: 'Proveedor',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['Kaspersky', 'Norton', 'McAfee', 'Bitdefender', 'ESET', 'Trend Micro'],
      },
      {
        attributeName: 'tipo_proteccion',
        attributeLabel: 'Tipo de Protección',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['Endpoint', 'Server', 'Cloud', 'Total Security'],
      },
      {
        attributeName: 'numero_dispositivos',
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          licenseTypeId: antivirusType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
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
        attributeName: 'modelo_compatible',
        attributeLabel: 'Modelo Compatible',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
        helpText: 'Ej: HP CF410A',
      },
      {
        attributeName: 'unidad_medida',
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          consumableTypeId: tonerType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${tonerAttrs.length} atributos para Tóner`)
  }

  // Atributos para Papel
  if (paperType) {
    const paperAttrs = [
      {
        attributeName: 'tamano',
        attributeLabel: 'Tamaño',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['A4', 'Carta', 'Oficio', 'A3'],
      },
      {
        attributeName: 'gramaje',
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
        attributeName: 'unidad_medida',
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
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          ...('helpText' in attr && (attr as { helpText?: string }).helpText !== undefined
            ? { helpText: (attr as { helpText?: string }).helpText }
            : {}),
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          consumableTypeId: paperType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          ...('helpText' in attr && (attr as { helpText?: string }).helpText !== undefined
            ? { helpText: (attr as { helpText?: string }).helpText }
            : {}),
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${paperAttrs.length} atributos para Papel`)
  }

  // ============================================
  // ATRIBUTOS PARA FIXED_ASSETS (Activos Fijos)
  // ============================================

  const acUnitType = await prisma.equipment_types.findFirst({
    where: { name: 'Aire Acondicionado' },
  })
  const generatorType = await prisma.equipment_types.findFirst({
    where: { name: 'Generador' },
  })

  // Atributos para Aire Acondicionado
  if (acUnitType) {
    const acAttrs = [
      {
        attributeName: 'fabricante',
        attributeLabel: 'Fabricante',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Carrier, Trane, Daikin',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
      },
      {
        attributeName: 'numero_serie',
        attributeLabel: 'Número de Serie',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
      },
      {
        attributeName: 'capacidad',
        attributeLabel: 'Capacidad (BTU)',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 4,
        helpText: 'Ej: 12000, 18000, 24000',
      },
      {
        attributeName: 'tipo',
        attributeLabel: 'Tipo',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 5,
        options: ['Split', 'Ventana', 'Central', 'Cassette', 'Piso-Techo'],
      },
      {
        attributeName: 'voltaje',
        attributeLabel: 'Voltaje',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 6,
        options: ['110V', '220V', '440V'],
      },
      {
        attributeName: 'refrigerante',
        attributeLabel: 'Tipo de Refrigerante',
        attributeType: 'select',
        isRequired: false,
        isVisible: true,
        order: 7,
        options: ['R-22', 'R-410A', 'R-32', 'R-134a'],
      },
    ]

    for (const attr of acAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: acUnitType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: acUnitType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${acAttrs.length} atributos para Aire Acondicionado`)
  }

  // Atributos para Generador
  if (generatorType) {
    const generatorAttrs = [
      {
        attributeName: 'fabricante',
        attributeLabel: 'Fabricante',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Caterpillar, Cummins, Kohler',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
      },
      {
        attributeName: 'numero_serie',
        attributeLabel: 'Número de Serie',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
      },
      {
        attributeName: 'potencia',
        attributeLabel: 'Potencia (kW)',
        attributeType: 'number',
        isRequired: true,
        isVisible: true,
        order: 4,
        helpText: 'Ej: 50, 100, 250',
      },
      {
        attributeName: 'voltaje',
        attributeLabel: 'Voltaje',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 5,
        options: ['110V', '220V', '440V', 'Trifásico'],
      },
      {
        attributeName: 'tipo_combustible',
        attributeLabel: 'Tipo de Combustible',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 6,
        options: ['Diesel', 'Gasolina', 'Gas Natural', 'Gas LP'],
      },
      {
        attributeName: 'capacidad_tanque',
        attributeLabel: 'Capacidad Tanque (L)',
        attributeType: 'number',
        isRequired: false,
        isVisible: true,
        order: 7,
        helpText: 'Capacidad del tanque de combustible',
      },
    ]

    for (const attr of generatorAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: generatorType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: generatorType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${generatorAttrs.length} atributos para Generador`)
  }

  // ============================================
  // ATRIBUTOS PARA SECURITY (Seguridad)
  // ============================================

  const cameraType = await prisma.equipment_types.findFirst({
    where: { name: 'Cámara IP' },
  })

  // Atributos para Cámara IP
  if (cameraType) {
    const cameraAttrs = [
      {
        attributeName: 'marca',
        attributeLabel: 'Marca',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: Hikvision, Dahua, Axis',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
      },
      {
        attributeName: 'numero_serie',
        attributeLabel: 'Número de Serie',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
      },
      {
        attributeName: 'resolucion',
        attributeLabel: 'Resolución',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 4,
        options: ['720p (1MP)', '1080p (2MP)', '4MP', '5MP', '8MP (4K)'],
      },
      {
        attributeName: 'tipo_lente',
        attributeLabel: 'Tipo de Lente',
        attributeType: 'select',
        isRequired: false,
        isVisible: true,
        order: 5,
        options: ['Fijo 2.8mm', 'Fijo 3.6mm', 'Varifocal 2.8-12mm', 'PTZ'],
      },
      {
        attributeName: 'vision_nocturna',
        attributeLabel: 'Visión Nocturna',
        attributeType: 'boolean',
        isRequired: false,
        isVisible: true,
        order: 6,
      },
      {
        attributeName: 'direccion_ip',
        attributeLabel: 'Dirección IP',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 7,
        helpText: 'Ej: 192.168.1.100',
      },
      {
        attributeName: 'ubicacion',
        attributeLabel: 'Ubicación',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 8,
        helpText: 'Ej: Entrada principal, Estacionamiento',
      },
    ]

    for (const attr of cameraAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: cameraType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: cameraType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${cameraAttrs.length} atributos para Cámara IP`)
  }

  // ============================================
  // ATRIBUTOS PARA MAINTENANCE (Mantenimiento)
  // ============================================

  const powerToolType = await prisma.equipment_types.findFirst({
    where: { name: 'Herramienta Eléctrica' },
  })

  // Atributos para Herramienta Eléctrica
  if (powerToolType) {
    const toolAttrs = [
      {
        attributeName: 'marca',
        attributeLabel: 'Marca',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 1,
        helpText: 'Ej: DeWalt, Makita, Bosch',
      },
      {
        attributeName: 'modelo',
        attributeLabel: 'Modelo',
        attributeType: 'text',
        isRequired: true,
        isVisible: true,
        order: 2,
      },
      {
        attributeName: 'numero_serie',
        attributeLabel: 'Número de Serie',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
      },
      {
        attributeName: 'tipo_herramienta',
        attributeLabel: 'Tipo de Herramienta',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 4,
        options: [
          'Taladro',
          'Esmeril',
          'Sierra',
          'Lijadora',
          'Atornillador',
          'Compresor',
          'Soldadora',
        ],
      },
      {
        attributeName: 'voltaje',
        attributeLabel: 'Voltaje',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 5,
        options: ['110V', '220V', 'Batería 12V', 'Batería 18V', 'Batería 20V'],
      },
      {
        attributeName: 'potencia',
        attributeLabel: 'Potencia (W)',
        attributeType: 'number',
        isRequired: false,
        isVisible: true,
        order: 6,
        helpText: 'Potencia en watts',
      },
    ]

    for (const attr of toolAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: powerToolType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          equipmentTypeId: powerToolType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          helpText: attr.helpText,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${toolAttrs.length} atributos para Herramienta Eléctrica`)
  }

  console.log('✅ Seed de atributos completado')
}
