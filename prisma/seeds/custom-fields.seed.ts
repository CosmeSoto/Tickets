/**
 * Seed: Custom Fields (Atributos Dinámicos)
 *
 * Crea campos personalizados para diferentes familias:
 * - Tecnología: procesador, ram, almacenamiento, sistema_operativo
 * - Activos Fijos: año_construccion, area_m2, estado_conservacion
 * - Mantenimiento: frecuencia_mantenimiento, ultima_revision
 */

import { PrismaClient } from '@prisma/client'

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
          fieldName: 'procesador',
          fieldLabel: 'Procesador',
          fieldType: 'text',
          fieldOptions: {
            maxLength: 100,
          },
          isRequired: false,
          order: 1,
          helpText: 'Modelo del procesador (ej: Intel Core i7-12700K)',
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
          order: 2,
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
          order: 3,
          helpText: 'Capacidad de almacenamiento en gigabytes',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'sistema_operativo',
          fieldLabel: 'Sistema Operativo',
          fieldType: 'select',
          fieldOptions: {
            options: ['Windows 10', 'Windows 11', 'macOS', 'Linux', 'Chrome OS', 'Otro'],
          },
          isRequired: false,
          order: 4,
          helpText: 'Sistema operativo instalado',
        },
        {
          familyId: technologyFamilyId,
          fieldName: 'tipo_disco',
          fieldLabel: 'Tipo de Disco',
          fieldType: 'select',
          fieldOptions: {
            options: ['HDD', 'SSD', 'NVMe', 'Híbrido'],
          },
          isRequired: false,
          order: 5,
          helpText: 'Tipo de disco de almacenamiento',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Tecnología (5 campos)')
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
          fieldName: 'anio_construccion',
          fieldLabel: 'Año de Construcción',
          fieldType: 'number',
          fieldOptions: {
            min: 1900,
            max: 2030,
          },
          isRequired: false,
          order: 1,
          helpText: 'Año en que se construyó o instaló el activo',
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
          order: 2,
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
          order: 3,
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
          order: 4,
          helpText: 'Ubicación específica del activo (edificio, piso, oficina)',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Activos Fijos (4 campos)')
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
          fieldOptions: null,
          isRequired: false,
          order: 2,
          helpText: 'Fecha de la última revisión o mantenimiento',
        },
        {
          familyId: maintenanceFamilyId,
          fieldName: 'proxima_revision',
          fieldLabel: 'Próxima Revisión',
          fieldType: 'date',
          fieldOptions: null,
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
          fieldName: 'nivel_seguridad',
          fieldLabel: 'Nivel de Seguridad',
          fieldType: 'select',
          fieldOptions: {
            options: ['Bajo', 'Medio', 'Alto', 'Crítico'],
          },
          isRequired: false,
          order: 1,
          helpText: 'Nivel de seguridad del equipo o sistema',
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
          order: 2,
          helpText: 'Certificaciones de seguridad (ej: ISO 27001)',
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
          order: 3,
          helpText: 'Área o zona que cubre el equipo de seguridad',
        },
      ],
      skipDuplicates: true,
    })
    console.log('  ✓ Campos para Seguridad (3 campos)')
  }

  console.log('✅ Campos personalizados creados')
}
