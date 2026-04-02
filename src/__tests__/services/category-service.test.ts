// Mock Prisma
jest.mock('@/lib/prisma', () => {
  const mockPrisma = {
    categories: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    tickets: {
      count: jest.fn(),
    },
  }
  return {
    __esModule: true,
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

import { CategoryService } from '@/lib/services/category-service'
import prisma from '@/lib/prisma'

const mockPrisma = prisma as any

describe('CategoryService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCategories', () => {
    const mockCategories = [
      {
        id: '1',
        name: 'Hardware',
        description: 'Hardware issues',
        color: '#FF0000',
        level: 0,
        isActive: true,
        parentId: null,
        parent: null,
        children: [
          {
            id: '2',
            name: 'Computers',
            color: '#FF5555',
            level: 1,
            isActive: true,
          },
        ],
        _count: { tickets: 5, other_categories: 1 },
      },
    ]

    it('should get all categories without filters', async () => {
      mockPrisma.categories.findMany.mockResolvedValue(mockCategories)

      const result = await CategoryService.getCategories()

      expect(mockPrisma.categories.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          include: expect.any(Object),
          orderBy: [{ level: 'asc' }, { name: 'asc' }],
        })
      )
      expect(result).toEqual(mockCategories)
    })

    it('should filter by parentId', async () => {
      mockPrisma.categories.findMany.mockResolvedValue(mockCategories)

      await CategoryService.getCategories({ parentId: '1' })

      expect(mockPrisma.categories.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { parentId: '1' },
        })
      )
    })

    it('should filter by search term', async () => {
      mockPrisma.categories.findMany.mockResolvedValue(mockCategories)

      await CategoryService.getCategories({ search: 'hardware' })

      expect(mockPrisma.categories.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { name: { contains: 'hardware', mode: 'insensitive' } },
              { description: { contains: 'hardware', mode: 'insensitive' } },
            ],
          },
        })
      )
    })
  })

  describe('getCategoryById', () => {
    const mockCategory = {
      id: '1',
      name: 'Hardware',
      description: 'Hardware issues',
      color: '#FF0000',
      level: 0,
      isActive: true,
      parentId: null,
    }

    it('should get category by id', async () => {
      mockPrisma.categories.findUnique.mockResolvedValue(mockCategory)

      const result = await CategoryService.getCategoryById('1')

      expect(mockPrisma.categories.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          include: expect.any(Object),
        })
      )
      expect(result).toEqual(mockCategory)
    })

    it('should return null for non-existent category', async () => {
      mockPrisma.categories.findUnique.mockResolvedValue(null)

      const result = await CategoryService.getCategoryById('999')

      expect(result).toBeNull()
    })
  })

  describe('createCategory', () => {
    const createData = {
      name: 'Software',
      description: 'Software issues',
      color: '#0000FF',
      level: 0,
      isActive: true,
    }

    it('should create a root category', async () => {
      const mockCreatedCategory = {
        id: '2',
        ...createData,
        level: 1, // createCategory sets level=1 for root
        parentId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock que no existe categoría con el mismo nombre
      mockPrisma.categories.findFirst.mockResolvedValue(null)
      mockPrisma.categories.create.mockResolvedValue(mockCreatedCategory)

      const result = await CategoryService.createCategory(createData)

      expect(mockPrisma.categories.findFirst).toHaveBeenCalled()
      expect(mockPrisma.categories.create).toHaveBeenCalled()
      expect(result).toEqual(mockCreatedCategory)
    })
  })

  describe('updateCategory', () => {
    const updateData = {
      name: 'Updated Hardware',
      description: 'Updated description',
      color: '#FF5555',
    }

    it('should update category', async () => {
      const existingCategory = {
        id: '1',
        name: 'Hardware',
        level: 0,
        parentId: null,
      }

      const mockUpdatedCategory = {
        ...existingCategory,
        ...updateData,
        updatedAt: new Date(),
      }

      mockPrisma.categories.findUnique.mockResolvedValue(existingCategory)
      // Mock findFirst for name uniqueness check (returns null = no duplicate)
      mockPrisma.categories.findFirst.mockResolvedValue(null)
      mockPrisma.categories.update.mockResolvedValue(mockUpdatedCategory)

      const result = await CategoryService.updateCategory('1', updateData)

      expect(mockPrisma.categories.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      })
      expect(mockPrisma.categories.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '1' },
          data: updateData,
          include: expect.any(Object),
        })
      )
      expect(result).toEqual(mockUpdatedCategory)
    })
  })

  describe('deleteCategory', () => {
    it('should delete category when no tickets assigned', async () => {
      const mockDeletedCategory = { id: '1', name: 'Deleted Category' }

      // Mock que no hay tickets asignados
      mockPrisma.tickets.count.mockResolvedValue(0)
      // Mock que no hay subcategorías
      mockPrisma.categories.count.mockResolvedValue(0)
      mockPrisma.categories.delete.mockResolvedValue(mockDeletedCategory)

      const result = await CategoryService.deleteCategory('1')

      expect(mockPrisma.tickets.count).toHaveBeenCalledWith({
        where: { categoryId: '1' },
      })
      expect(mockPrisma.categories.count).toHaveBeenCalledWith({
        where: { parentId: '1' },
      })
      expect(mockPrisma.categories.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      })
      expect(result).toEqual(mockDeletedCategory)
    })
  })
})