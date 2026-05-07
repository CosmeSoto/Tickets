/**
 * Tests para equipment-models.service
 * Verifica la lógica de negocio del servicio de modelos
 */

import * as modelService from '@/lib/services/equipment-models.service'
import prisma from '@/lib/prisma'

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    equipment_models: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    equipment_types: {
      findUnique: jest.fn(),
    },
    equipment: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

describe('EquipmentModelsService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createModel', () => {
    it('debe crear un modelo correctamente', async () => {
      const mockType = {
        id: 'type-1',
        name: 'Laptop',
        code: 'LAPTOP',
      }

      const mockModel = {
        id: 'model-1',
        brand: 'Dell',
        model: 'Latitude 5420',
        sku: 'DELL-LAT-5420',
        typeId: 'type-1',
        specifications: {},
        defaultAccessories: ['Cargador'],
        standardPrice: 1000,
        modelPhotoUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: mockType,
      }

      ;(prisma.equipment_types.findUnique as jest.Mock).mockResolvedValue(mockType)
      ;(prisma.equipment_models.findFirst as jest.Mock).mockResolvedValue(null)
      ;(prisma.equipment_models.create as jest.Mock).mockResolvedValue(mockModel)

      const result = await modelService.createModel({
        brand: 'Dell',
        model: 'Latitude 5420',
        sku: 'DELL-LAT-5420',
        typeId: 'type-1',
        defaultAccessories: ['Cargador'],
        standardPrice: 1000,
      })

      expect(result).toEqual(mockModel)
      expect(prisma.equipment_types.findUnique).toHaveBeenCalledWith({
        where: { id: 'type-1' },
      })
      expect(prisma.equipment_models.create).toHaveBeenCalled()
    })

    it('debe lanzar error si el tipo no existe', async () => {
      ;(prisma.equipment_types.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        modelService.createModel({
          brand: 'Dell',
          model: 'Latitude 5420',
          typeId: 'non-existent',
        })
      ).rejects.toThrow('El tipo de equipo no existe')
    })

    it('debe lanzar error si el modelo ya existe', async () => {
      const mockType = { id: 'type-1', name: 'Laptop', code: 'LAPTOP' }
      const existingModel = { id: 'model-1', brand: 'Dell', model: 'Latitude 5420' }

      ;(prisma.equipment_types.findUnique as jest.Mock).mockResolvedValue(mockType)
      ;(prisma.equipment_models.findFirst as jest.Mock).mockResolvedValue(existingModel)

      await expect(
        modelService.createModel({
          brand: 'Dell',
          model: 'Latitude 5420',
          typeId: 'type-1',
        })
      ).rejects.toThrow('Ya existe un modelo con esta marca, modelo y tipo')
    })
  })

  describe('getModelById', () => {
    it('debe obtener un modelo por ID', async () => {
      const mockModel = {
        id: 'model-1',
        brand: 'Dell',
        model: 'Latitude 5420',
        type: {
          id: 'type-1',
          name: 'Laptop',
          code: 'LAPTOP',
          family: {
            id: 'family-1',
            name: 'Tecnología',
            code: 'TECH',
          },
        },
      }

      ;(prisma.equipment_models.findUnique as jest.Mock).mockResolvedValue(mockModel)

      const result = await modelService.getModelById('model-1')

      expect(result).toEqual(mockModel)
      expect(prisma.equipment_models.findUnique).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        include: expect.any(Object),
      })
    })

    it('debe lanzar error si no existe', async () => {
      ;(prisma.equipment_models.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(modelService.getModelById('non-existent')).rejects.toThrow(
        'Modelo no encontrado'
      )
    })
  })

  describe('searchModels', () => {
    it('debe buscar modelos por query', async () => {
      const mockModels = [
        {
          id: 'model-1',
          brand: 'Dell',
          model: 'Latitude 5420',
          type: { id: 'type-1', name: 'Laptop', code: 'LAPTOP' },
        },
      ]

      ;(prisma.equipment_models.findMany as jest.Mock).mockResolvedValue(mockModels)

      const result = await modelService.searchModels('Dell')

      expect(result).toEqual(mockModels)
      expect(prisma.equipment_models.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.any(Array),
          }),
        })
      )
    })
  })

  describe('getModelWithStock', () => {
    it('debe obtener un modelo con información de stock', async () => {
      const mockModel = {
        id: 'model-1',
        brand: 'Dell',
        model: 'Latitude 5420',
        sku: 'DELL-LAT-5420',
        typeId: 'type-1',
        specifications: {},
        defaultAccessories: [],
        standardPrice: 1000,
        modelPhotoUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        type: { id: 'type-1', name: 'Laptop', code: 'LAPTOP' },
      }

      const mockEquipment = [
        { status: 'AVAILABLE' },
        { status: 'AVAILABLE' },
        { status: 'ASSIGNED' },
        { status: 'MAINTENANCE' },
      ]

      ;(prisma.equipment_models.findUnique as jest.Mock).mockResolvedValue(mockModel)
      ;(prisma.equipment.findMany as jest.Mock).mockResolvedValue(mockEquipment)

      const result = await modelService.getModelWithStock('model-1')

      expect(result.stock).toEqual({
        total: 4,
        available: 2,
        assigned: 1,
        maintenance: 1,
        forSale: 0,
        sold: 0,
        retired: 0,
      })
    })
  })

  describe('deleteModel', () => {
    it('debe eliminar un modelo (soft delete) si no tiene equipos', async () => {
      ;(prisma.equipment.count as jest.Mock).mockResolvedValue(0)
      ;(prisma.equipment_models.update as jest.Mock).mockResolvedValue({
        id: 'model-1',
        isActive: false,
      })

      const result = await modelService.deleteModel('model-1')

      expect(result.success).toBe(true)
      expect(prisma.equipment_models.update).toHaveBeenCalledWith({
        where: { id: 'model-1' },
        data: { isActive: false },
      })
    })

    it('debe lanzar error si tiene equipos asociados', async () => {
      ;(prisma.equipment.count as jest.Mock).mockResolvedValue(5)

      await expect(modelService.deleteModel('model-1')).rejects.toThrow(
        'No se puede eliminar el modelo porque tiene 5 equipos asociados'
      )
    })
  })

  describe('listModels', () => {
    it('debe listar modelos con paginación', async () => {
      const mockModels = [
        {
          id: 'model-1',
          brand: 'Dell',
          model: 'Latitude 5420',
          type: { id: 'type-1', name: 'Laptop', code: 'LAPTOP', family: {} },
        },
      ]

      ;(prisma.equipment_models.findMany as jest.Mock).mockResolvedValue(mockModels)
      ;(prisma.equipment_models.count as jest.Mock).mockResolvedValue(1)

      const result = await modelService.listModels({ page: 1, limit: 10 })

      expect(result.models).toEqual(mockModels)
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      })
    })

    it('debe filtrar por typeId', async () => {
      ;(prisma.equipment_models.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.equipment_models.count as jest.Mock).mockResolvedValue(0)

      await modelService.listModels({ typeId: 'type-1' })

      expect(prisma.equipment_models.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            typeId: 'type-1',
          }),
        })
      )
    })

    it('debe filtrar por familyId', async () => {
      ;(prisma.equipment_models.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.equipment_models.count as jest.Mock).mockResolvedValue(0)

      await modelService.listModels({ familyId: 'family-1' })

      expect(prisma.equipment_models.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: {
              familyId: 'family-1',
            },
          }),
        })
      )
    })
  })
})
