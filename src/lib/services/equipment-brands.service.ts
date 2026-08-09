/**
 * Servicio de Gestión de Marcas de Equipos
 * Maneja el catálogo maestro de marcas (equipment_brands)
 */

import prisma from '@/lib/prisma'

export interface CreateBrandInput {
  code: string
  name: string
  description?: string
  logoUrl?: string
  isActive?: boolean
  order?: number
  familyId: string
}

export interface UpdateBrandInput {
  code?: string
  name?: string
  description?: string
  logoUrl?: string
  isActive?: boolean
  order?: number
  familyId?: string
}

/**
 * Crea una nueva marca de equipo
 */
export async function createBrand(data: CreateBrandInput) {
  try {
    // Verificar que no exista una marca con el mismo código
    const existingBrand = await prisma.equipment_brands.findUnique({
      where: { code: data.code },
    })

    if (existingBrand) {
      throw new Error('Ya existe una marca con ese código')
    }

    if (!data.familyId) {
      throw new Error('familyId es requerido')
    }

    let order = data.order
    if (order == null) {
      const maxOrder = await prisma.equipment_brands.aggregate({
        where: { familyId: data.familyId },
        _max: { order: true },
      })
      order = (maxOrder._max.order ?? -1) + 1
    }

    // Crear la marca
    const brand = await prisma.equipment_brands.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description || null,
        logoUrl: data.logoUrl || null,
        isActive: data.isActive ?? true,
        order,
        familyId: data.familyId,
      },
    })

    return brand
  } catch (error: any) {
    console.error('Error creando marca:', error)
    throw error
  }
}

/**
 * Obtiene una marca por ID
 */
export async function getBrandById(id: string) {
  try {
    const brand = await prisma.equipment_brands.findUnique({
      where: { id },
    })

    if (!brand) {
      throw new Error('Marca no encontrada')
    }

    return brand
  } catch (error: any) {
    console.error('Error obteniendo marca:', error)
    throw error
  }
}

/**
 * Lista marcas de una familia (configuración admin).
 */
export async function listBrandsForFamily(familyId: string, includeInactive = false) {
  return prisma.equipment_brands.findMany({
    where: {
      familyId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  })
}

/**
 * Lista marcas con filtros y paginación (operación / formularios).
 */
export async function listBrands({
  page = 1,
  limit = 50,
  familyId,
  scopeFilter,
  isActive = true,
  search,
}: {
  page?: number
  limit?: number
  familyId?: string
  scopeFilter?: Record<string, unknown>
  isActive?: boolean
  search?: string
}) {
  try {
    const where: Record<string, unknown> = { ...(scopeFilter ?? {}) }

    if (familyId && !scopeFilter) {
      where.familyId = familyId
    }

    if (isActive !== undefined) {
      where.isActive = isActive
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    const skip = (page - 1) * limit

    const [brands, total] = await Promise.all([
      prisma.equipment_brands.findMany({
        where,
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.equipment_brands.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      brands,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  } catch (error: any) {
    console.error('Error listando marcas:', error)
    throw error
  }
}

/**
 * Actualiza una marca
 */
export async function updateBrand(id: string, data: UpdateBrandInput) {
  try {
    // Verificar que la marca existe
    const existingBrand = await prisma.equipment_brands.findUnique({
      where: { id },
    })

    if (!existingBrand) {
      throw new Error('Marca no encontrada')
    }

    // Si se cambia el código, verificar que no exista otro
    if (data.code && data.code !== existingBrand.code) {
      const duplicateCode = await prisma.equipment_brands.findUnique({
        where: { code: data.code },
      })

      if (duplicateCode) {
        throw new Error('Ya existe una marca con ese código')
      }
    }

    // Actualizar la marca
    const brand = await prisma.equipment_brands.update({
      where: { id },
      data,
    })

    return brand
  } catch (error: any) {
    console.error('Error actualizando marca:', error)
    throw error
  }
}

/**
 * Elimina una marca (soft delete si tiene modelos asociados)
 */
export async function deleteBrand(id: string) {
  try {
    // Verificar que la marca existe
    const existingBrand = await prisma.equipment_brands.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            models: true,
          },
        },
      },
    })

    if (!existingBrand) {
      throw new Error('Marca no encontrada')
    }

    // Si tiene modelos asociados, solo desactivar
    if (existingBrand._count.models > 0) {
      const brand = await prisma.equipment_brands.update({
        where: { id },
        data: { isActive: false },
      })

      return {
        success: true,
        message: `Marca desactivada (tiene ${existingBrand._count.models} modelos asociados)`,
        brand,
      }
    }

    // Si no tiene modelos, eliminar completamente
    await prisma.equipment_brands.delete({
      where: { id },
    })

    return {
      success: true,
      message: 'Marca eliminada',
    }
  } catch (error: any) {
    console.error('Error eliminando marca:', error)
    throw error
  }
}
