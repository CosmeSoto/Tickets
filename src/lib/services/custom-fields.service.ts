/**
 * CustomFieldsService - Servicio para gestión de atributos dinámicos por familia
 *
 * @deprecated Este servicio usa el sistema legacy de custom fields por familia.
 * Para nuevos desarrollos, usa los servicios específicos por tipo:
 * - EquipmentAttributesService
 * - LicenseAttributesService  
 * - ConsumableAttributesService
 *
 * Este servicio seguirá funcionando hasta el 2026-06-08 para compatibilidad.
 * Los datos se leen de las nuevas tablas de atributos por tipo cuando están disponibles.
 */

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'boolean'

export interface CustomField {
  id: string
  familyId: string
  fieldName: string
  fieldLabel: string
  fieldType: FieldType
  fieldOptions?: any
  isRequired: boolean
  order: number
  helpText?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CustomFieldValue {
  id: string
  equipmentId: string
  fieldName: string
  fieldValue: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateCustomFieldInput {
  familyId: string
  fieldName: string
  fieldLabel: string
  fieldType: FieldType
  fieldOptions?: any
  isRequired?: boolean
  order?: number
  helpText?: string
}

export interface UpdateCustomFieldInput {
  fieldLabel?: string
  fieldType?: FieldType
  fieldOptions?: any
  isRequired?: boolean
  order?: number
  helpText?: string
}

export interface SetCustomValueInput {
  equipmentId: string
  fieldName: string
  fieldValue: string
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class CustomFieldsService {
  /**
   * Crea un nuevo campo personalizado para una familia
   */
  static async createCustomField(data: CreateCustomFieldInput): Promise<CustomField> {
    // Validar que el fieldName sea único para la familia
    const existing = await prisma.family_custom_fields.findUnique({
      where: {
        familyId_fieldName: {
          familyId: data.familyId,
          fieldName: data.fieldName,
        },
      },
    })

    if (existing) {
      throw new Error(`El campo "${data.fieldName}" ya existe para esta familia`)
    }

    // Validar fieldType
    const validTypes: FieldType[] = ['text', 'number', 'select', 'date', 'boolean']
    if (!validTypes.includes(data.fieldType)) {
      throw new Error(`Tipo de campo inválido: ${data.fieldType}`)
    }

    // Validar fieldOptions para select
    if (data.fieldType === 'select' && (!data.fieldOptions || !Array.isArray(data.fieldOptions))) {
      throw new Error('Los campos de tipo "select" requieren un array de opciones')
    }

    const field = await prisma.family_custom_fields.create({
      data: {
        id: randomUUID(),
        familyId: data.familyId,
        fieldName: data.fieldName,
        fieldLabel: data.fieldLabel,
        fieldType: data.fieldType,
        fieldOptions: data.fieldOptions || null,
        isRequired: data.isRequired || false,
        order: data.order || 0,
        helpText: data.helpText || null,
      },
    })

    return field as CustomField
  }

  /**
   * Obtiene todos los campos personalizados de una familia
   */
  static async getCustomFieldsByFamily(familyId: string): Promise<CustomField[]> {
    const fields = await prisma.family_custom_fields.findMany({
      where: { familyId },
      orderBy: { order: 'asc' },
    })

    return fields as CustomField[]
  }

  /**
   * Obtiene un campo personalizado por ID
   */
  static async getCustomFieldById(id: string): Promise<CustomField | null> {
    const field = await prisma.family_custom_fields.findUnique({
      where: { id },
    })

    return field as CustomField | null
  }

  /**
   * Actualiza un campo personalizado
   */
  static async updateCustomField(id: string, data: UpdateCustomFieldInput): Promise<CustomField> {
    const field = await prisma.family_custom_fields.findUnique({
      where: { id },
    })

    if (!field) {
      throw new Error('Campo personalizado no encontrado')
    }

    // Validar fieldType si se está actualizando
    if (data.fieldType) {
      const validTypes: FieldType[] = ['text', 'number', 'select', 'date', 'boolean']
      if (!validTypes.includes(data.fieldType)) {
        throw new Error(`Tipo de campo inválido: ${data.fieldType}`)
      }
    }

    // Validar fieldOptions para select
    if (data.fieldType === 'select' && (!data.fieldOptions || !Array.isArray(data.fieldOptions))) {
      throw new Error('Los campos de tipo "select" requieren un array de opciones')
    }

    const updated = await prisma.family_custom_fields.update({
      where: { id },
      data: {
        ...(data.fieldLabel && { fieldLabel: data.fieldLabel }),
        ...(data.fieldType && { fieldType: data.fieldType }),
        ...(data.fieldOptions !== undefined && { fieldOptions: data.fieldOptions }),
        ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
        ...(data.order !== undefined && { order: data.order }),
        ...(data.helpText !== undefined && { helpText: data.helpText }),
      },
    })

    return updated as CustomField
  }

  /**
   * Elimina un campo personalizado
   * También elimina todos los valores asociados
   */
  static async deleteCustomField(id: string): Promise<void> {
    const field = await prisma.family_custom_fields.findUnique({
      where: { id },
    })

    if (!field) {
      throw new Error('Campo personalizado no encontrado')
    }

    // Eliminar valores asociados
    await prisma.equipment_custom_values.deleteMany({
      where: { fieldName: field.fieldName },
    })

    // Eliminar campo
    await prisma.family_custom_fields.delete({
      where: { id },
    })
  }

  /**
   * Establece el valor de un campo personalizado para un equipo
   */
  static async setCustomValue(data: SetCustomValueInput): Promise<CustomFieldValue> {
    // Verificar que el equipo existe
    const equipment = await prisma.equipment.findUnique({
      where: { id: data.equipmentId },
      include: { type: { include: { family: true } } },
    })

    if (!equipment) {
      throw new Error('Equipo no encontrado')
    }

    const familyId = equipment.type.family.id

    // Verificar que el campo existe para la familia
    const field = await prisma.family_custom_fields.findUnique({
      where: {
        familyId_fieldName: {
          familyId,
          fieldName: data.fieldName,
        },
      },
    })

    if (!field) {
      throw new Error(`El campo "${data.fieldName}" no existe para esta familia`)
    }

    // Validar el valor según el tipo de campo
    this.validateFieldValue(field, data.fieldValue)

    // Crear o actualizar el valor
    const value = await prisma.equipment_custom_values.upsert({
      where: {
        equipmentId_fieldName: {
          equipmentId: data.equipmentId,
          fieldName: data.fieldName,
        },
      },
      create: {
        id: randomUUID(),
        equipmentId: data.equipmentId,
        fieldName: data.fieldName,
        fieldValue: data.fieldValue,
      },
      update: {
        fieldValue: data.fieldValue,
      },
    })

    return value as CustomFieldValue
  }

  /**
   * Obtiene todos los valores personalizados de un equipo
   */
  static async getCustomValuesByEquipment(equipmentId: string): Promise<CustomFieldValue[]> {
    const values = await prisma.equipment_custom_values.findMany({
      where: { equipmentId },
    })

    return values as CustomFieldValue[]
  }

  /**
   * Obtiene los valores personalizados de un equipo con sus definiciones
   * 
   * ACTUALIZADO: Ahora lee de las nuevas tablas de atributos por tipo
   * Mantiene compatibilidad con custom fields legacy
   */
  static async getCustomValuesWithDefinitions(equipmentId: string): Promise<
    Array<{
      field: CustomField
      value: CustomFieldValue | null
    }>
  > {
    // Obtener el equipo con su familia y tipo
    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: { 
        type: { 
          include: { 
            family: true,
            attributes: true, // Nuevos atributos por tipo
          } 
        } 
      },
    })

    if (!equipment) {
      throw new Error('Equipo no encontrado')
    }

    const familyId = equipment.type.family.id
    const equipmentTypeId = equipment.type.id

    // PRIORIDAD 1: Intentar obtener atributos del nuevo sistema (por tipo)
    let fields: CustomField[] = []
    
    if (equipment.type.attributes && equipment.type.attributes.length > 0) {
      // Convertir atributos de tipo a formato CustomField
      fields = equipment.type.attributes
        .filter((attr: any) => attr.isVisible)
        .sort((a: any, b: any) => a.order - b.order)
        .map((attr: any) => ({
          id: attr.id,
          familyId: familyId,
          fieldName: attr.attributeName,
          fieldLabel: attr.attributeLabel,
          fieldType: attr.attributeType as any,
          fieldOptions: attr.options,
          isRequired: attr.isRequired,
          order: attr.order,
          helpText: attr.helpText,
          createdAt: attr.createdAt,
          updatedAt: attr.updatedAt,
        }))
    } else {
      // FALLBACK: Usar custom fields legacy por familia
      fields = await this.getCustomFieldsByFamily(familyId)
    }

    // Obtener valores del equipo
    const values = await this.getCustomValuesByEquipment(equipmentId)

    // Combinar campos con valores
    return fields.map(field => ({
      field,
      value: values.find(v => v.fieldName === field.fieldName) || null,
    }))
  }

  /**
   * Elimina un valor personalizado
   */
  static async deleteCustomValue(equipmentId: string, fieldName: string): Promise<void> {
    await prisma.equipment_custom_values.delete({
      where: {
        equipmentId_fieldName: {
          equipmentId,
          fieldName,
        },
      },
    })
  }

  /**
   * Establece múltiples valores personalizados para un equipo
   */
  static async setMultipleCustomValues(
    equipmentId: string,
    values: Array<{ fieldName: string; fieldValue: string }>
  ): Promise<CustomFieldValue[]> {
    const results: CustomFieldValue[] = []

    for (const value of values) {
      const result = await this.setCustomValue({
        equipmentId,
        fieldName: value.fieldName,
        fieldValue: value.fieldValue,
      })
      results.push(result)
    }

    return results
  }

  /**
   * Valida el valor de un campo según su tipo
   */
  private static validateFieldValue(field: any, value: string): void {
    switch (field.fieldType) {
      case 'number':
        if (isNaN(Number(value))) {
          throw new Error(`El campo "${field.fieldLabel}" debe ser un número`)
        }
        // Validar rango si está definido
        if (field.fieldOptions) {
          const num = Number(value)
          if (field.fieldOptions.min !== undefined && num < field.fieldOptions.min) {
            throw new Error(
              `El campo "${field.fieldLabel}" debe ser mayor o igual a ${field.fieldOptions.min}`
            )
          }
          if (field.fieldOptions.max !== undefined && num > field.fieldOptions.max) {
            throw new Error(
              `El campo "${field.fieldLabel}" debe ser menor o igual a ${field.fieldOptions.max}`
            )
          }
        }
        break

      case 'select':
        if (field.fieldOptions && Array.isArray(field.fieldOptions)) {
          if (!field.fieldOptions.includes(value)) {
            throw new Error(
              `El valor "${value}" no es válido para el campo "${field.fieldLabel}". Opciones válidas: ${field.fieldOptions.join(', ')}`
            )
          }
        }
        break

      case 'date':
        if (isNaN(Date.parse(value))) {
          throw new Error(`El campo "${field.fieldLabel}" debe ser una fecha válida`)
        }
        break

      case 'boolean':
        if (value !== 'true' && value !== 'false') {
          throw new Error(`El campo "${field.fieldLabel}" debe ser true o false`)
        }
        break

      case 'text':
        // Validar longitud máxima si está definida
        if (field.fieldOptions?.maxLength && value.length > field.fieldOptions.maxLength) {
          throw new Error(
            `El campo "${field.fieldLabel}" no puede tener más de ${field.fieldOptions.maxLength} caracteres`
          )
        }
        break
    }

    // Validar campo requerido
    if (field.isRequired && (!value || value.trim() === '')) {
      throw new Error(`El campo "${field.fieldLabel}" es requerido`)
    }
  }

  /**
   * Busca equipos por valor de campo personalizado
   */
  static async searchEquipmentByCustomValue(
    familyId: string,
    fieldName: string,
    fieldValue: string
  ): Promise<string[]> {
    const values = await prisma.equipment_custom_values.findMany({
      where: {
        fieldName,
        fieldValue: {
          contains: fieldValue,
          mode: 'insensitive',
        },
        equipment: {
          type: {
            familyId,
          },
        },
      },
      select: {
        equipmentId: true,
      },
    })

    return values.map(v => v.equipmentId)
  }
}
