import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

/**
 * Seed de atributos para tipos de inventario
 * Crea atributos de ejemplo para equipment_types, license_types y consumable_types
 */
export async function seedAttributes(prisma: PrismaClient, familyMap: Map<string, string>) {
  console.log('🔧 Seeding atributos de tipos de inventario...')

  const adminFamilyId = familyMap.get('ADMINISTRATIVE')!

  // ============================================
  // ATRIBUTOS PARA EQUIPMENT TYPES
  // ============================================

  // Obtener tipos de equipo existentes
  const computerType = await prisma.equipment_types.findFirst({
    where: {
      OR: [
        { name: 'Desktop', familyId: adminFamilyId },
        { name: 'Computadora de Escritorio', familyId: adminFamilyId },
      ],
    },
  })
  const laptopType = await prisma.equipment_types.findFirst({
    where: { name: 'Laptop', familyId: adminFamilyId },
  })
  const printerType = await prisma.equipment_types.findFirst({
    where: { name: 'Impresora', familyId: adminFamilyId },
  })

  // Atributos para Computadora de Escritorio
  if (computerType) {
    const computerAttrs = [
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
        attributeLabel: 'Pantalla',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 9,
        options: ['13.3', '14', '15.6', '17'],
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
          helpText: (attr as any).helpText ?? null,
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
          helpText: (attr as any).helpText ?? null,
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
    where: { name: 'Office 365', familyId: adminFamilyId },
  })
  const antivirusType = await prisma.license_types.findFirst({
    where: { name: 'Antivirus', familyId: adminFamilyId },
  })
  const windowsType = await prisma.license_types.findFirst({
    where: { name: 'Windows', familyId: adminFamilyId },
  })
  const adobeType = await prisma.license_types.findFirst({
    where: { name: 'Adobe', familyId: adminFamilyId },
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
    where: { name: 'Tóner', familyId: adminFamilyId },
  })
  const paperType = await prisma.consumable_types.findFirst({
    where: { name: 'Papel', familyId: adminFamilyId },
  })
  const waterJugType = await prisma.consumable_types.findFirst({
    where: {
      OR: [
        { code: 'WATER_JUG', familyId: adminFamilyId },
        { name: 'Botellón de agua', familyId: adminFamilyId },
      ],
    },
  })
  const beverageType = await prisma.consumable_types.findFirst({
    where: {
      OR: [
        { code: 'BEVERAGE', familyId: adminFamilyId },
        { name: 'Bebidas', familyId: adminFamilyId },
      ],
    },
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

  // Atributos para Botellón de agua (consumo diario / dispensers)
  if (waterJugType) {
    const waterJugAttrs = [
      {
        attributeName: 'capacidad_litros',
        attributeLabel: 'Capacidad',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 1,
        options: ['5 L', '10 L', '20 L'],
        helpText: 'Capacidad típica del botellón retornable',
      },
      {
        attributeName: 'formato',
        attributeLabel: 'Formato',
        attributeType: 'select',
        isRequired: true,
        isVisible: true,
        order: 2,
        options: ['Retornable', 'Desechable'],
      },
      {
        attributeName: 'marca',
        attributeLabel: 'Marca / proveedor de agua',
        attributeType: 'text',
        isRequired: false,
        isVisible: true,
        order: 3,
        helpText: 'Ej: Tesalia, Güitig, marca local',
      },
    ]

    for (const attr of waterJugAttrs) {
      await prisma.consumable_type_attributes.upsert({
        where: {
          consumableTypeId_attributeName: {
            consumableTypeId: waterJugType.id,
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
          consumableTypeId: waterJugType.id,
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
    console.log(`  ✅ ${waterJugAttrs.length} atributos para Botellón de agua`)
  }

  // Atributos para categoría genérica Bebidas
  if (beverageType) {
    const beverageAttrs = [
      {
        attributeName: 'presentacion',
        attributeLabel: 'Presentación',
        attributeType: 'select',
        isRequired: false,
        isVisible: true,
        order: 1,
        options: ['Botellón', 'Botella', 'Lata', 'Caja', 'Otro'],
      },
      {
        attributeName: 'sabor_tipo',
        attributeLabel: 'Tipo',
        attributeType: 'select',
        isRequired: false,
        isVisible: true,
        order: 2,
        options: ['Agua', 'Gaseosa', 'Jugo', 'Café/Té', 'Otro'],
      },
    ]

    for (const attr of beverageAttrs) {
      await prisma.consumable_type_attributes.upsert({
        where: {
          consumableTypeId_attributeName: {
            consumableTypeId: beverageType.id,
            attributeName: attr.attributeName,
          },
        },
        update: {
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          options: attr.options ? { options: attr.options } : undefined,
        },
        create: {
          id: randomUUID(),
          consumableTypeId: beverageType.id,
          attributeName: attr.attributeName,
          attributeLabel: attr.attributeLabel,
          attributeType: attr.attributeType,
          isRequired: attr.isRequired,
          isVisible: attr.isVisible,
          order: attr.order,
          options: attr.options ? { options: attr.options } : undefined,
        },
      })
    }
    console.log(`  ✅ ${beverageAttrs.length} atributos para Bebidas`)
  }

  // ============================================
  // TIPOS: Aire Acondicionado / Generador (Arquitectura / Operaciones)
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
  // TIPOS: Cámara IP (Operaciones — Seguridad)
  // ============================================

  const cameraType = await prisma.equipment_types.findFirst({
    where: { name: 'Cámara IP' },
  })

  // Atributos para Cámara IP
  if (cameraType) {
    const cameraAttrs = [
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
  // TIPOS: Herramienta Eléctrica (Operaciones — Mantenimiento)
  // ============================================

  const powerToolType = await prisma.equipment_types.findFirst({
    where: { name: 'Herramienta Eléctrica' },
  })

  // Atributos para Herramienta Eléctrica
  if (powerToolType) {
    const toolAttrs = [
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

  // ── Limpieza: eliminar atributos 'unidad_medida' duplicados con el campo global unitOfMeasureId ──
  const deletedUoM = await prisma.consumable_type_attributes.deleteMany({
    where: { attributeName: 'unidad_medida' },
  })
  if (deletedUoM.count > 0) {
    console.log(
      `  🧹 Eliminados ${deletedUoM.count} atributos 'unidad_medida' redundantes (se usa el campo global)`
    )
  }

  // ============================================
  // ATRIBUTOS COMUNES PARA TIPOS EN TODAS LAS FAMILIAS
  // Busca todos los tipos Laptop/Desktop/Monitor en familias diferentes a ADMINISTRATIVE
  // y les asigna los mismos atributos base (procesador, ram, almacenamiento, etc.)
  // ============================================

  const commonComputerAttrs = [
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
    },
    {
      attributeName: 'almacenamiento',
      attributeLabel: 'Almacenamiento (GB)',
      attributeType: 'number',
      isRequired: true,
      isVisible: true,
      order: 6,
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
  ]

  const monitorAttrs = [
    {
      attributeName: 'tamano_pantalla',
      attributeLabel: 'Tamaño (pulgadas)',
      attributeType: 'number',
      isRequired: true,
      isVisible: true,
      order: 4,
    },
    {
      attributeName: 'resolucion',
      attributeLabel: 'Resolución',
      attributeType: 'select',
      isRequired: true,
      isVisible: true,
      order: 5,
      options: ['1920x1080 (Full HD)', '2560x1440 (2K)', '3840x2160 (4K)'],
    },
    {
      attributeName: 'tipo_panel',
      attributeLabel: 'Tipo de Panel',
      attributeType: 'select',
      isRequired: false,
      isVisible: true,
      order: 6,
      options: ['IPS', 'VA', 'TN', 'OLED'],
    },
    {
      attributeName: 'conexiones',
      attributeLabel: 'Conexiones',
      attributeType: 'text',
      isRequired: false,
      isVisible: true,
      order: 7,
      helpText: 'Ej: HDMI, DisplayPort, USB-C',
    },
  ]

  // Buscar tipos en TODAS las familias (upsert no duplica si ya existe)
  const commonLaptops = await prisma.equipment_types.findMany({
    where: { name: 'Laptop' },
  })
  const commonDesktops = await prisma.equipment_types.findMany({
    where: { name: 'Desktop' },
  })
  const commonMonitors = await prisma.equipment_types.findMany({
    where: { name: 'Monitor' },
  })
  const commonPrinters = await prisma.equipment_types.findMany({
    where: { name: 'Impresora' },
  })

  // Atributos extra solo para laptops (además de los comunes de computador)
  const laptopExtraAttrs: typeof commonComputerAttrs = [
    {
      attributeName: 'pantalla_pulgadas',
      attributeLabel: 'Pantalla (pulgadas)',
      attributeType: 'number',
      isRequired: false,
      isVisible: true,
      order: 9,
      helpText: 'Ej: 14',
    },
  ]

  // Atributos para impresoras comunes
  const printerCommonAttrs: Array<{
    attributeName: string
    attributeLabel: string
    attributeType: string
    isRequired: boolean
    isVisible: boolean
    order: number
    options?: string[]
    helpText?: string
  }> = [
    {
      attributeName: 'tipo_impresion',
      attributeLabel: 'Tipo de Impresión',
      attributeType: 'select',
      isRequired: true,
      isVisible: true,
      order: 4,
      options: ['Láser', 'Inyección', 'Matricial', 'Térmica'],
    },
    {
      attributeName: 'color',
      attributeLabel: 'Color',
      attributeType: 'select',
      isRequired: true,
      isVisible: true,
      order: 5,
      options: ['Color', 'Monocromática'],
    },
    {
      attributeName: 'conectividad',
      attributeLabel: 'Conectividad',
      attributeType: 'select',
      isRequired: false,
      isVisible: true,
      order: 6,
      options: ['USB', 'Red (Ethernet)', 'WiFi', 'USB + Red', 'USB + WiFi'],
    },
  ]

  // Atributos para teléfonos (móviles y convencionales)
  const phoneCommonAttrs: Array<{
    attributeName: string
    attributeLabel: string
    attributeType: string
    isRequired: boolean
    isVisible: boolean
    order: number
    options?: string[]
    helpText?: string
  }> = [
    {
      attributeName: 'tipo_telefono',
      attributeLabel: 'Tipo',
      attributeType: 'select',
      isRequired: true,
      isVisible: true,
      order: 4,
      options: ['Móvil', 'Convencional (fijo)', 'IP', 'Inalámbrico DECT'],
    },
    {
      attributeName: 'extension',
      attributeLabel: 'Extensión',
      attributeType: 'text',
      isRequired: false,
      isVisible: true,
      order: 5,
      helpText: 'Ej: 201, 305 (solo para fijos/IP)',
    },
    {
      attributeName: 'linea_telefonica',
      attributeLabel: 'Línea / Número',
      attributeType: 'text',
      isRequired: false,
      isVisible: true,
      order: 6,
      helpText: 'Ej: +593 987654321',
    },
    {
      attributeName: 'plan_datos',
      attributeLabel: 'Plan / Operador',
      attributeType: 'text',
      isRequired: false,
      isVisible: true,
      order: 7,
      helpText: 'Ej: Claro 10GB, CNT Corporativo',
    },
  ]

  let commonAttrCount = 0

  // Laptops: atributos de computador + pantalla
  for (const eqType of commonLaptops) {
    for (const attr of [...commonComputerAttrs, ...laptopExtraAttrs]) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: eqType.id,
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
          equipmentTypeId: eqType.id,
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
      commonAttrCount++
    }
  }

  // Desktops: atributos de computador
  for (const eqType of commonDesktops) {
    for (const attr of commonComputerAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: eqType.id,
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
          equipmentTypeId: eqType.id,
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
      commonAttrCount++
    }
  }

  // Monitores
  for (const eqType of commonMonitors) {
    for (const attr of monitorAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: eqType.id,
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
          equipmentTypeId: eqType.id,
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
      commonAttrCount++
    }
  }

  // Impresoras
  for (const eqType of commonPrinters) {
    for (const attr of printerCommonAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: eqType.id,
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
          equipmentTypeId: eqType.id,
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
      commonAttrCount++
    }
  }

  // Teléfonos
  const commonPhones = await prisma.equipment_types.findMany({
    where: { name: 'Teléfono' },
  })
  for (const eqType of commonPhones) {
    for (const attr of phoneCommonAttrs) {
      await prisma.equipment_type_attributes.upsert({
        where: {
          equipmentTypeId_attributeName: {
            equipmentTypeId: eqType.id,
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
          equipmentTypeId: eqType.id,
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
      commonAttrCount++
    }
  }

  if (commonAttrCount > 0) {
    console.log(
      `  ✅ ${commonAttrCount} atributos comunes para tipos Laptop/Desktop/Monitor en otras familias`
    )
  }

  console.log('✅ Seed de atributos completado')
}
