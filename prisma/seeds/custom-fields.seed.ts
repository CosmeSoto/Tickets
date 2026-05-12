/**
 * Seed: Custom Fields (Atributos Dinámicos)
 *
 * Crea campos personalizados para diferentes familias:
 * - Tecnología: procesador, ram, almacenamiento, sistema_operativo
 * - Activos Fijos: año_construccion, area_m2, estado_conservacion
 * - Mantenimiento: frecuencia_mantenimiento, ultima_revision
 */

import { Prisma, PrismaClient } from '@prisma/client'

export async function seedCustomFields(prisma: PrismaClient, familyMap: Map<string, string>) {
  console.log('🎨 Creando campos personalizados...')

  const fam = (code: string) => familyMap.get(code)

  // ============================================
  // FAMILIA: TECNOLOGÍA (Technology)
  // ============================================

  const technologyFamilyId = fam('TECHNOLOGY')
  if (technologyFamilyId) {
    await prisma.family_custom_fields.createMany({
      data: [
        {
          familyId: technologyFamilyId,
          fieldName: 'marca',
          fieldLabel: 'Marca',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 50,
          },
          isRequired: false,
          order: 1,
          helpText: 'Marca del equipo (ej: Dell, HP, Lenovo, Apple)',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'modelo',
          fieldLabel: 'Modelo',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 2,
          helpText: 'Modelo específico del equipo',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'numero_serie',
          fieldLabel: 'Número de Serie',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 3,
          helpText: 'Número de serie del fabricante',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'procesador',
          fieldLabel: 'Procesador',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 4,
          helpText: 'Modelo del procesador (ej: Intel Core i7-12700K, AMD Ryzen 7 5800X)',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'ram',
          fieldLabel: 'RAM (GB)',
          fieldType: 'number',
          fieldOptions: {
            min: 1,
            max: 256,
          },
          isRequired: false,
          order: 5,
          helpText: 'Memoria RAM en gigabytes',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'almacenamiento',
          fieldLabel: 'Almacenamiento (GB)',
          fieldType: 'number',
          fieldOptions: {
            min: 1,
            max: 10000,
          },
          isRequired: false,
          order: 6,
          helpText: 'Capacidad de almacenamiento en gigabytes',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'tipo_disco',
          fieldLabel: 'Tipo de Disco',
          fieldType: 'select',
          fieldOptions: {
            options: ['HDD', 'SSD', 'NVMe', 'M.2 SSD', 'Híbrido'],
          },
          isRequired: false,
          order: 7,
          helpText: 'Tipo de disco de almacenamiento',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'sistema_operativo',
          fieldLabel: 'Sistema Operativo',
          fieldType: 'select',
          fieldOptions: {
            options: [
              'Windows 10',
              'Windows 11',
              'macOS Monterey',
              'macOS Ventura',
              'macOS Sonoma',
              'Ubuntu',
              'Linux',
              'Chrome OS',
              'Otro',
            ],
          },
          isRequired: false,
          order: 8,
          helpText: 'Sistema operativo instalado',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'tarjeta_grafica',
          fieldLabel: 'Tarjeta Gráfica',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 9,
          helpText: 'Modelo de tarjeta gráfica (ej: NVIDIA RTX 3060, Intel Iris Xe)',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'pantalla_pulgadas',
          fieldLabel: 'Tamaño Pantalla (pulgadas)',
          fieldType: 'number',
          fieldOptions: {
            min: 10,
            max: 65,
          },
          isRequired: false,
          order: 10,
          helpText: 'Tamaño de pantalla en pulgadas (para laptops, monitores)',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'resolucion',
          fieldLabel: 'Resolución',
          fieldType: 'select',
          fieldOptions: {
            options: [
              '1366x768 (HD)',
              '1920x1080 (Full HD)',
              '2560x1440 (2K)',
              '3840x2160 (4K)',
              'Otra',
            ],
          },
          isRequired: false,
          order: 11,
          helpText: 'Resolución de pantalla',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'direccion_ip',
          fieldLabel: 'Dirección IP',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 50,
          },
          isRequired: false,
          order: 12,
          helpText: 'Dirección IP asignada (para equipos de red)',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'direccion_mac',
          fieldLabel: 'Dirección MAC',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 50,
          },
          isRequired: false,
          order: 13,
          helpText: 'Dirección MAC del equipo',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'garantia_hasta',
          fieldLabel: 'Garantía Hasta',
          fieldType: 'date',
          fieldOptions: Prisma.DbNull,
          isRequired: false,
          order: 14,
          helpText: 'Fecha de vencimiento de la garantía',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Tecnología (14 campos)')
  }

  // ============================================
  // FAMILIA: ACTIVOS FIJOS (Fixed Assets)
  // ============================================

  const fixedAssetsFamilyId = fam('FIXED_ASSETS')
  if (fixedAssetsFamilyId) {
    await prisma.family_custom_fields.createMany({
      data: [
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'fabricante',
          fieldLabel: 'Fabricante',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 1,
          helpText: 'Fabricante del equipo o activo',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'modelo',
          fieldLabel: 'Modelo',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 2,
          helpText: 'Modelo del activo',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'numero_serie',
          fieldLabel: 'Número de Serie',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 3,
          helpText: 'Número de serie del fabricante',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'anio_construccion',
          fieldLabel: 'Año de Construcción/Instalación',
          fieldType: 'number',
          fieldOptions: {
            min: 1900,
            max: 2030,
          },
          isRequired: false,
          order: 4,
          helpText: 'Año en que se construyó o instaló el activo',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'capacidad',
          fieldLabel: 'Capacidad',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 5,
          helpText: 'Capacidad del equipo (ej: 5 toneladas, 100 kW, 500 litros)',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'voltaje',
          fieldLabel: 'Voltaje',
          fieldType: 'select',
          fieldOptions: {
            options: ['110V', '220V', '380V', '440V', 'Trifásico', 'Otro'],
          },
          isRequired: false,
          order: 6,
          helpText: 'Voltaje de operación',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'potencia',
          fieldLabel: 'Potencia (kW)',
          fieldType: 'number',
          fieldOptions: {
            min: 0,
            max: 10000,
          },
          isRequired: false,
          order: 7,
          helpText: 'Potencia en kilovatios',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'area_m2',
          fieldLabel: 'Área (m²)',
          fieldType: 'number',
          fieldOptions: {
            min: 0,
            max: 999999,
          },
          isRequired: false,
          order: 8,
          helpText: 'Área en metros cuadrados',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'estado_conservacion',
          fieldLabel: 'Estado de Conservación',
          fieldType: 'select',
          fieldOptions: {
            options: ['Excelente', 'Bueno', 'Regular', 'Malo', 'Crítico'],
          },
          isRequired: false,
          order: 9,
          helpText: 'Estado físico del activo',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'ubicacion_fisica',
          fieldLabel: 'Ubicación Física',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 200,
          },
          isRequired: false,
          order: 10,
          helpText: 'Ubicación específica del activo (edificio, piso, sala)',
        },
        {
          familyId: fixedAssetsFamilyId,
          fieldName: 'certificaciones',
          fieldLabel: 'Certificaciones',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 200,
          },
          isRequired: false,
          order: 11,
          helpText: 'Certificaciones o normas que cumple (ej: ISO, CE, UL)',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Activos Fijos (11 campos)')
  }

  // ============================================
  // FAMILIA: MANTENIMIENTO (Maintenance)
  // ============================================

  const maintenanceFamilyId = fam('MAINTENANCE')
  if (maintenanceFamilyId) {
    await prisma.family_custom_fields.createMany({
      data: [
        {
          familyId: maintenanceFamilyId,
          fieldName: 'frecuencia_mantenimiento',
          fieldLabel: 'Frecuencia de Mantenimiento',
          fieldType: 'select',
          fieldOptions: {
            options: [
              'Diario',
              'Semanal',
              'Quincenal',
              'Mensual',
              'Trimestral',
              'Semestral',
              'Anual',
            ],
          },
          isRequired: false,
          order: 1,
          helpText: 'Frecuencia recomendada de mantenimiento',
        },
        {
          familyId: maintenanceFamilyId,
          fieldName: 'ultima_revision',
          fieldLabel: 'Última Revisión',
          fieldType: 'date',
          fieldOptions: Prisma.DbNull,
          isRequired: false,
          order: 2,
          helpText: 'Fecha de la última revisión o mantenimiento',
        },
        {
          familyId: maintenanceFamilyId,
          fieldName: 'proxima_revision',
          fieldLabel: 'Próxima Revisión',
          fieldType: 'date',
          fieldOptions: Prisma.DbNull,
          isRequired: false,
          order: 3,
          helpText: 'Fecha programada para la próxima revisión',
        },
        {
          familyId: maintenanceFamilyId,
          fieldName: 'tipo_mantenimiento',
          fieldLabel: 'Tipo de Mantenimiento',
          fieldType: 'select',
          fieldOptions: {
            options: ['Preventivo', 'Correctivo', 'Predictivo', 'Emergencia'],
          },
          isRequired: false,
          order: 4,
          helpText: 'Tipo de mantenimiento aplicable',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Mantenimiento (4 campos)')
  }

  // ============================================
  // FAMILIA: SEGURIDAD (Security)
  // ============================================

  const securityFamilyId = fam('SECURITY')
  if (securityFamilyId) {
    await prisma.family_custom_fields.createMany({
      data: [
        {
          familyId: securityFamilyId,
          fieldName: 'marca',
          fieldLabel: 'Marca',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 50,
          },
          isRequired: false,
          order: 1,
          helpText: 'Marca del equipo de seguridad (ej: Hikvision, Dahua, Honeywell)',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'modelo',
          fieldLabel: 'Modelo',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 2,
          helpText: 'Modelo específico del equipo',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'numero_serie',
          fieldLabel: 'Número de Serie',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 3,
          helpText: 'Número de serie del fabricante',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'resolucion',
          fieldLabel: 'Resolución',
          fieldType: 'select',
          fieldOptions: {
            options: ['720p (1MP)', '1080p (2MP)', '1440p (4MP)', '4K (8MP)', '5MP', 'Otra'],
          },
          isRequired: false,
          order: 4,
          helpText: 'Resolución de cámara (para cámaras IP)',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'tipo_lente',
          fieldLabel: 'Tipo de Lente',
          fieldType: 'select',
          fieldOptions: {
            options: ['Fijo 2.8mm', 'Fijo 3.6mm', 'Fijo 6mm', 'Varifocal 2.8-12mm', 'PTZ', 'Otro'],
          },
          isRequired: false,
          order: 5,
          helpText: 'Tipo de lente de la cámara',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'vision_nocturna',
          fieldLabel: 'Visión Nocturna',
          fieldType: 'boolean',
          fieldOptions: Prisma.DbNull,
          isRequired: false,
          order: 6,
          helpText: 'Indica si tiene visión nocturna infrarroja',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'direccion_ip',
          fieldLabel: 'Dirección IP',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 50,
          },
          isRequired: false,
          order: 7,
          helpText: 'Dirección IP asignada',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'nivel_seguridad',
          fieldLabel: 'Nivel de Seguridad',
          fieldType: 'select',
          fieldOptions: {
            options: ['Bajo', 'Medio', 'Alto', 'Crítico'],
          },
          isRequired: false,
          order: 8,
          helpText: 'Nivel de seguridad del equipo o sistema',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'zona_cobertura',
          fieldLabel: 'Zona de Cobertura',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 200,
          },
          isRequired: false,
          order: 9,
          helpText: 'Área o zona que cubre el equipo de seguridad',
        },
        {
          familyId: securityFamilyId,
          fieldName: 'certificacion',
          fieldLabel: 'Certificación',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 10,
          helpText: 'Certificaciones de seguridad (ej: ISO 27001, UL)',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Seguridad (10 campos)')
  }

  console.log('✅ Campos personalizados creados')
}
