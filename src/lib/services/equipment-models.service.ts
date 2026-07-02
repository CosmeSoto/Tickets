/**
 * Servicio de Gestión de Modelos de Equipos
 * Maneja el catálogo maestro de modelos (equipment_models)
 */

import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface CreateModelInput {
  brandId: string
  model: string
  sku?: string
  typeId: string
  specifications?: Record<string, any>
  defaultAccessories?: string[]
  standardPrice?: number
  modelPhotoUrl?: string
  isActive?: boolean
}

export interface UpdateModelInput {
  brandId?: string
  model?: string
  sku?: string
  typeId?: string
  specifications?: Record<string, any>
  defaultAccessories?: string[]
  standardPrice?: number
  modelPhotoUrl?: string
  isActive?: boolean
}

export interface ModelWithStock {
  id: string
  brandId: string | null
  model: string
  sku: string | null
  typeId: string
  specifications?: Record<string, any> | null
  defaultAccessories: string[]
  standardPrice: number | null
  modelPhotoUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  brand?: {
    id: string
    name: string
  } | null
  type: {
    id: string
    name: string
    code: string
  }
  stock: {
    total: number
    available: number
    assigned: number
    maintenance: number
    forSale: number
    sold: number
    retired: number
  }
}

/**
 * Crea un nuevo modelo de equipo
 */
export async function createModel(data: CreateModelInput) {
  try {
    // Verificar que el tipo existe
    const typeExists = await prisma.equipment_types.findUnique({
      where: { id: data.typeId },
    })

    if (!typeExists) {
      throw new Error('El tipo de equipo no existe')
    }

    // Verificar que la marca existe
    const brandExists = await prisma.equipment_brands.findUnique({
      where: { id: data.brandId },
    })

    if (!brandExists) {
      throw new Error('La marca no existe')
    }

    // Verificar que no exista el mismo modelo (solo activos)
    const existingModel = await prisma.equipment_models.findFirst({
      where: {
        brandId: data.brandId,
        model: data.model,
        typeId: data.typeId,
        isActive: true,
      },
    })

    if (existingModel) {
      throw new Error('Ya existe un modelo con esta marca, modelo y tipo')
    }

    // Crear el modelo
    const model = await prisma.equipment_models.create({
      data: {
        brandId: data.brandId,
        model: data.model,
        sku: data.sku,
        typeId: data.typeId,
        defaultAccessories: data.defaultAccessories || [],
        standardPrice: data.standardPrice,
        modelPhotoUrl: data.modelPhotoUrl,
        isActive: data.isActive ?? true,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    return model
  } catch (error: any) {
    console.error('Error creando modelo:', error)
    throw error
  }
}

/**
 * Obtiene un modelo por ID
 */
export async function getModelById(id: string) {
  try {
    const model = await prisma.equipment_models.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
            code: true,
            family: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    })

    if (!model) {
      throw new Error('Modelo no encontrado')
    }

    return model
  } catch (error: any) {
    console.error('Error obteniendo modelo:', error)
    throw error
  }
}

/**
 * Obtiene modelos por tipo
 */
export async function getModelsByType(typeId: string) {
  try {
    const models = await prisma.equipment_models.findMany({
      where: {
        typeId,
        isActive: true,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [{ model: 'asc' }],
    })

    return models
  } catch (error: any) {
    console.error('Error obteniendo modelos por tipo:', error)
    throw error
  }
}

/**
 * Actualiza un modelo
 */
export async function updateModel(id: string, data: UpdateModelInput) {
  try {
    // Verificar que el modelo existe
    const existingModel = await prisma.equipment_models.findUnique({
      where: { id },
    })

    if (!existingModel) {
      throw new Error('Modelo no encontrado')
    }

    // Si se actualiza typeId, verificar que existe
    if (data.typeId) {
      const typeExists = await prisma.equipment_types.findUnique({
        where: { id: data.typeId },
      })

      if (!typeExists) {
        throw new Error('El tipo de equipo no existe')
      }
    }

    // Si se actualiza brandId, verificar que existe
    if (data.brandId) {
      const brandExists = await prisma.equipment_brands.findUnique({
        where: { id: data.brandId },
      })

      if (!brandExists) {
        throw new Error('La marca no existe')
      }
    }

    // Actualizar el modelo
    const model = await prisma.equipment_models.update({
      where: { id },
      data: {
        brandId: data.brandId,
        model: data.model,
        sku: data.sku,
        typeId: data.typeId,
        defaultAccessories: data.defaultAccessories,
        standardPrice: data.standardPrice,
        modelPhotoUrl: data.modelPhotoUrl,
        isActive: data.isActive,
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    return model
  } catch (error: any) {
    console.error('Error actualizando modelo:', error)
    throw error
  }
}

/**
 * Elimina un modelo completamente (hard delete)
 */
export async function deleteModel(id: string) {
  try {
    // Verificar que no haya equipos asociados
    const equipmentCount = await prisma.equipment.count({
      where: { modelId: id },
    })

    if (equipmentCount > 0) {
      throw new Error(
        `No se puede eliminar el modelo porque tiene ${equipmentCount} equipos asociados`
      )
    }

    // Hard delete - eliminar completamente de la base de datos
    await prisma.equipment_models.delete({
      where: { id },
    })

    return { success: true }
  } catch (error: any) {
    console.error('Error eliminando modelo:', error)
    throw error
  }
}

/**
 * Busca modelos por texto
 */
export async function searchModels(query: string, limit = 20, familyId?: string) {
  try {
    const models = await prisma.equipment_models.findMany({
      where: {
        isActive: true,
        ...(familyId ? { type: { familyId } } : {}),
        OR: [
          { brand: { name: { contains: query, mode: 'insensitive' } } },
          { model: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
            code: true,
            familyId: true,
          },
        },
      },
      orderBy: [{ model: 'asc' }],
      take: limit,
    })

    return models.map(m => ({
      ...m,
      brand: m.brand?.name ?? '',
    }))
  } catch (error: any) {
    console.error('Error buscando modelos:', error)
    throw error
  }
}

/**
 * Obtiene un modelo con información de stock
 */
export async function getModelWithStock(id: string): Promise<ModelWithStock> {
  try {
    const model = await prisma.equipment_models.findUnique({
      where: { id },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
          },
        },
        type: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    })

    if (!model) {
      throw new Error('Modelo no encontrado')
    }

    // Obtener stock por estado
    const equipment = await prisma.equipment.findMany({
      where: { modelId: id },
      select: { status: true },
    })

    const stock = {
      total: equipment.length,
      available: equipment.filter(e => e.status === 'AVAILABLE').length,
      assigned: equipment.filter(e => e.status === 'ASSIGNED').length,
      maintenance: equipment.filter(e => e.status === 'MAINTENANCE').length,
      forSale: equipment.filter(e => e.status === 'FOR_SALE').length,
      sold: equipment.filter(e => e.status === 'SOLD').length,
      retired: equipment.filter(e => e.status === 'RETIRED').length,
    }

    return {
      ...model,
      stock,
    }
  } catch (error: any) {
    console.error('Error obteniendo modelo con stock:', error)
    throw error
  }
}

/**
 * Lista todos los modelos con paginación
 */
export async function listModels(params: {
  page?: number
  limit?: number
  typeId?: string
  brandId?: string
  familyId?: string
  isActive?: boolean
  search?: string
}) {
  try {
    const { page = 1, limit = 50, typeId, brandId, familyId, isActive = true, search } = params

    const where: Prisma.equipment_modelsWhereInput = {
      isActive,
      ...(typeId && { typeId }),
      ...(brandId && { brandId }),
      ...(familyId && {
        type: {
          familyId,
        },
      }),
      ...(search && {
        OR: [
          { brand: { name: { contains: search, mode: 'insensitive' } } },
          { model: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
    }

    const [models, total] = await Promise.all([
      prisma.equipment_models.findMany({
        where,
        include: {
          brand: {
            select: {
              id: true,
              name: true,
            },
          },
          type: {
            select: {
              id: true,
              name: true,
              code: true,
              family: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
        orderBy: [{ model: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.equipment_models.count({ where }),
    ])

    return {
      models,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  } catch (error: any) {
    console.error('Error listando modelos:', error)
    throw error
  }
}
