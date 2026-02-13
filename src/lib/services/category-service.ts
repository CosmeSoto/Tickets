import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface CategoryFilters {
  parentId?: string | null
  level?: number
  isActive?: boolean
  search?: string
}

export interface CreateCategoryData {
  name: string
  description?: string
  color: string
  parentId?: string
  level: number
  isActive?: boolean
}

export interface UpdateCategoryData {
  name?: string
  description?: string
  color?: string
  parentId?: string
  isActive?: boolean
}

export class CategoryService {
  static async getCategories(filters: CategoryFilters = {}) {
    const where: any = {}

    if (filters.parentId !== undefined) where.parentId = filters.parentId
    if (filters.level !== undefined) where.level = filters.level
    if (filters.isActive !== undefined) where.isActive = filters.isActive
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    return prisma.categories.findMany({
      where,
      include: {
        other_categories: {
          select: { id: true, name: true, color: true, level: true },
          where: { isActive: true },
        },
        _count: { select: { tickets: true, other_categories: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    })
  }

  static async getCategoryById(id: string) {
    return prisma.categories.findUnique({
      where: { id },
      include: {
        other_categories: {
          select: { id: true, name: true, color: true, level: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        tickets: {
          select: { id: true, title: true, status: true, priority: true, createdAt: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { tickets: true, other_categories: true } },
      },
    })
  }

  static async createCategory(data: CreateCategoryData) {
    // Validar nivel jerárquico
    if (data.parentId) {
      const parent = await prisma.categories.findUnique({
        where: { id: data.parentId },
        select: { level: true },
      })

      if (!parent) {
        throw new Error('Categoría padre no encontrada')
      }

      if (parent.level >= 4) {
        throw new Error('No se pueden crear más de 4 niveles de categorías')
      }

      data.level = parent.level + 1
    } else {
      data.level = 1
    }

    // Verificar que no exista una categoría con el mismo nombre en el mismo nivel
    const existingCategory = await prisma.categories.findFirst({
      where: {
        name: data.name,
        parentId: data.parentId || null,
        level: data.level,
      },
    })

    if (existingCategory) {
      throw new Error('Ya existe una categoría con este nombre en este nivel')
    }

    return prisma.categories.create({
      data: {
        id: randomUUID(),
        ...data,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        _count: { select: { tickets: true, other_categories: true } },
      },
    })
  }

  static async updateCategory(id: string, data: UpdateCategoryData) {
    const category = await prisma.categories.findUnique({ where: { id } })
    if (!category) throw new Error('Categoría no encontrada')

    // Si se está cambiando el padre, validar jerarquía
    if (data.parentId !== undefined) {
      if (data.parentId) {
        const parent = await prisma.categories.findUnique({
          where: { id: data.parentId },
          select: { level: true },
        })

        if (!parent) {
          throw new Error('Categoría padre no encontrada')
        }

        if (parent.level >= 4) {
          throw new Error('No se pueden crear más de 4 niveles de categorías')
        }

        // Verificar que no se esté creando una referencia circular
        if (await this.wouldCreateCircularReference(id, data.parentId)) {
          throw new Error('Esta operación crearía una referencia circular')
        }
      }
    }

    // Verificar nombre único en el mismo nivel
    if (data.name && data.name !== category.name) {
      const existingCategory = await prisma.categories.findFirst({
        where: {
          name: data.name,
          parentId: data.parentId ?? category.parentId,
          id: { not: id },
        },
      })

      if (existingCategory) {
        throw new Error('Ya existe una categoría con este nombre en este nivel')
      }
    }

    return prisma.categories.update({
      where: { id },
      data,
      include: {
        other_categories: {
          select: { id: true, name: true, color: true, level: true },
          where: { isActive: true },
        },
        _count: { select: { tickets: true, other_categories: true } },
      },
    })
  }

  static async deleteCategory(id: string) {
    // Verificar que no tenga tickets asignados
    const ticketCount = await prisma.tickets.count({
      where: { categoryId: id },
    })

    if (ticketCount > 0) {
      throw new Error('No se puede eliminar una categoría con tickets asignados')
    }

    // Verificar que no tenga subcategorías
    const childrenCount = await prisma.categories.count({
      where: { parentId: id },
    })

    if (childrenCount > 0) {
      throw new Error('No se puede eliminar una categoría con subcategorías')
    }

    return prisma.categories.delete({ where: { id } })
  }

  static async getCategoryTree() {
    const categories = await prisma.categories.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { tickets: true } },
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    })

    // Construir árbol jerárquico
    const categoryMap = new Map()
    const rootCategories: any[] = []

    // Crear mapa de categorías
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
      })
    })

    // Construir jerarquía
    categories.forEach(category => {
      const categoryWithChildren = categoryMap.get(category.id)

      if (category.parentId) {
        const parent = categoryMap.get(category.parentId)
        if (parent) {
          parent.children.push(categoryWithChildren)
        }
      } else {
        rootCategories.push(categoryWithChildren)
      }
    })

    return rootCategories
  }

  static async getCategoryStats() {
    const [
      totalCategories,
      activeCategories,
      level1Categories,
      level2Categories,
      level3Categories,
      level4Categories,
      categoriesWithTickets,
    ] = await Promise.all([
      prisma.categories.count(),
      prisma.categories.count({ where: { isActive: true } }),
      prisma.categories.count({ where: { level: 1 } }),
      prisma.categories.count({ where: { level: 2 } }),
      prisma.categories.count({ where: { level: 3 } }),
      prisma.categories.count({ where: { level: 4 } }),
      prisma.categories.count({
        where: {
          tickets: {
            some: {},
          },
        },
      }),
    ])

    return {
      totalCategories,
      activeCategories,
      inactiveCategories: totalCategories - activeCategories,
      level1Categories,
      level2Categories,
      level3Categories,
      level4Categories,
      categoriesWithTickets,
      categoriesWithoutTickets: totalCategories - categoriesWithTickets,
    }
  }

  private static async wouldCreateCircularReference(
    categoryId: string,
    newParentId: string
  ): Promise<boolean> {
    // Verificar si el nuevo padre es descendiente de la categoría actual
    let currentParentId: string | null = newParentId

    while (currentParentId) {
      if (currentParentId === categoryId) {
        return true
      }

      const category: { parentId: string | null } | null = await prisma.categories.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      })

      currentParentId = category?.parentId || null
    }

    return false
  }

  static async getAvailableParents(excludeId?: string) {
    const where: any = {
      level: { lt: 4 }, // Solo categorías que pueden tener hijos
      isActive: true,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    return prisma.categories.findMany({
      where,
      select: {
        id: true,
        name: true,
        level: true,
        color: true,
      },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    })
  }
}
