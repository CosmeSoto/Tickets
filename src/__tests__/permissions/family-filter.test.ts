/**
 * Tests de Permisos: Family Filter Middleware
 *
 * Verifica que el middleware de filtrado por familia funciona correctamente
 * para cada rol de usuario.
 */

import {
  applyEquipmentFamilyFilter,
  applyAssetRequestFamilyFilter,
  hasAccessToEquipment,
  hasAccessToFamily,
  getAccessibleFamilies,
  createUserContext,
} from '@/lib/middleware/family-filter'
import { UserRole } from '@prisma/client'

const nativeFamilyId = 'family-native'

jest.mock('@/lib/auth/admin-scope', () => ({
  getModuleFamilyIds: jest.fn().mockResolvedValue([]),
}))

jest.mock('@/lib/prisma', () => {
  const prismaMock = {
    users: { findUnique: jest.fn() },
    admin_family_assignments: { findMany: jest.fn() },
    technician_family_assignments: { findMany: jest.fn() },
    inventory_manager_families: { findMany: jest.fn() },
    equipment_assignments: { findMany: jest.fn(), findFirst: jest.fn() },
    equipment: { findUnique: jest.fn() },
    families: { findMany: jest.fn() },
  }
  return {
    prisma: prismaMock,
    __esModule: true,
    default: prismaMock,
  }
})

import { prisma } from '@/lib/prisma'
import { getModuleFamilyIds } from '@/lib/auth/admin-scope'

describe('Family Filter Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.users.findUnique as jest.Mock).mockResolvedValue({
      departments: { familyId: nativeFamilyId },
    })
    ;(getModuleFamilyIds as jest.Mock).mockResolvedValue([])
    ;(prisma.inventory_manager_families.findMany as jest.Mock).mockResolvedValue([])
  })

  describe('applyEquipmentFamilyFilter', () => {
    it('SUPER_ADMIN: debe retornar filtro vacío (sin restricciones)', async () => {
      const context = {
        userId: 'super-admin-1',
        userRole: 'ADMIN' as UserRole,
        isSuperAdmin: true,
      }

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({})
    })

    it('FAMILY_ADMIN: debe filtrar por familias del módulo inventario', async () => {
      const context = {
        userId: 'admin-1',
        userRole: 'ADMIN' as UserRole,
        isSuperAdmin: false,
      }

      ;(getModuleFamilyIds as jest.Mock).mockResolvedValue(['family-1', 'family-2'])

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({
        familyId: { in: ['family-1', 'family-2'] },
      })
    })

    it('FAMILY_ADMIN sin familias de módulo: usa familia nativa', async () => {
      const context = {
        userId: 'admin-1',
        userRole: 'ADMIN' as UserRole,
        isSuperAdmin: false,
      }

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({ familyId: { in: [nativeFamilyId] } })
    })

    it('TECHNICIAN gestor: filtra por nativa e inventory_manager_families', async () => {
      const context = {
        userId: 'tech-1',
        userRole: 'TECHNICIAN' as UserRole,
        isSuperAdmin: false,
        canManageInventory: true,
      }

      ;(prisma.inventory_manager_families.findMany as jest.Mock).mockResolvedValue([
        { familyId: 'family-1' },
      ])

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({
        familyId: { in: expect.arrayContaining([nativeFamilyId, 'family-1']) },
      })
    })

    it('TECHNICIAN sin gestión: solo familia nativa', async () => {
      const context = {
        userId: 'tech-1',
        userRole: 'TECHNICIAN' as UserRole,
        isSuperAdmin: false,
        canManageInventory: false,
      }

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({
        familyId: { in: [nativeFamilyId] },
      })
    })

    it('CLIENT: debe filtrar por equipos asignados', async () => {
      const context = {
        userId: 'client-1',
        userRole: 'CLIENT' as UserRole,
        isSuperAdmin: false,
      }

      ;(prisma.equipment_assignments.findMany as jest.Mock).mockResolvedValue([
        { equipmentId: 'eq-1' },
        { equipmentId: 'eq-2' },
      ])

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({
        id: { in: ['eq-1', 'eq-2'] },
      })
    })

    it('CLIENT sin equipos: debe retornar filtro que no muestra nada', async () => {
      const context = {
        userId: 'client-1',
        userRole: 'CLIENT' as UserRole,
        isSuperAdmin: false,
      }

      ;(prisma.equipment_assignments.findMany as jest.Mock).mockResolvedValue([])

      const filter = await applyEquipmentFamilyFilter(context)

      expect(filter).toEqual({ id: 'none' })
    })
  })

  describe('hasAccessToEquipment', () => {
    it('SUPER_ADMIN: debe tener acceso a cualquier equipo', async () => {
      const hasAccess = await hasAccessToEquipment(
        'super-admin-1',
        'ADMIN' as UserRole,
        true,
        'any-equipment-id'
      )

      expect(hasAccess).toBe(true)
    })

    it('FAMILY_ADMIN: debe tener acceso a equipos de familias visibles', async () => {
      ;(prisma.equipment.findUnique as jest.Mock).mockResolvedValue({
        type: { familyId: 'family-1' },
      })
      ;(getModuleFamilyIds as jest.Mock).mockResolvedValue(['family-1'])

      const hasAccess = await hasAccessToEquipment(
        'admin-1',
        'ADMIN' as UserRole,
        false,
        'equipment-1'
      )

      expect(hasAccess).toBe(true)
    })

    it('FAMILY_ADMIN: NO debe tener acceso a equipos de otras familias', async () => {
      ;(prisma.equipment.findUnique as jest.Mock).mockResolvedValue({
        type: { familyId: 'family-2' },
      })
      ;(getModuleFamilyIds as jest.Mock).mockResolvedValue(['family-1'])

      const hasAccess = await hasAccessToEquipment(
        'admin-1',
        'ADMIN' as UserRole,
        false,
        'equipment-1'
      )

      expect(hasAccess).toBe(false)
    })

    it('CLIENT: debe tener acceso a equipos asignados', async () => {
      ;(prisma.equipment.findUnique as jest.Mock).mockResolvedValue({
        familyId: 'family-1',
      })
      ;(prisma.equipment_assignments.findFirst as jest.Mock).mockResolvedValue({
        equipmentId: 'equipment-1',
        receiverId: 'client-1',
        status: 'ACTIVE',
      })

      const hasAccess = await hasAccessToEquipment(
        'client-1',
        'CLIENT' as UserRole,
        false,
        'equipment-1'
      )

      expect(hasAccess).toBe(true)
    })

    it('CLIENT: NO debe tener acceso a equipos no asignados', async () => {
      ;(prisma.equipment.findUnique as jest.Mock).mockResolvedValue({
        familyId: 'family-1',
      })
      ;(prisma.equipment_assignments.findFirst as jest.Mock).mockResolvedValue(null)

      const hasAccess = await hasAccessToEquipment(
        'client-1',
        'CLIENT' as UserRole,
        false,
        'equipment-1'
      )

      expect(hasAccess).toBe(false)
    })
  })

  describe('hasAccessToFamily', () => {
    it('SUPER_ADMIN: debe tener acceso a cualquier familia', async () => {
      const hasAccess = await hasAccessToFamily(
        'super-admin-1',
        'ADMIN' as UserRole,
        true,
        'any-family-id'
      )

      expect(hasAccess).toBe(true)
    })

    it('FAMILY_ADMIN: debe tener acceso a familias del módulo inventario', async () => {
      ;(getModuleFamilyIds as jest.Mock).mockResolvedValue(['family-1', 'family-2'])

      const hasAccess = await hasAccessToFamily('admin-1', 'ADMIN' as UserRole, false, 'family-1')

      expect(hasAccess).toBe(true)
    })

    it('FAMILY_ADMIN: NO debe tener acceso a familias fuera de visibilidad', async () => {
      ;(getModuleFamilyIds as jest.Mock).mockResolvedValue(['family-1'])

      const hasAccess = await hasAccessToFamily('admin-1', 'ADMIN' as UserRole, false, 'family-2')

      expect(hasAccess).toBe(false)
    })

    it('CLIENT: NO debe tener acceso directo a familias', async () => {
      const hasAccess = await hasAccessToFamily('client-1', 'CLIENT' as UserRole, false, 'family-1')

      expect(hasAccess).toBe(false)
    })
  })

  describe('getAccessibleFamilies', () => {
    it('SUPER_ADMIN: debe retornar todas las familias', async () => {
      const context = {
        userId: 'super-admin-1',
        userRole: 'ADMIN' as UserRole,
        isSuperAdmin: true,
      }

      ;(prisma.families.findMany as jest.Mock).mockResolvedValue([
        { id: 'family-1', name: 'Computadoras', code: 'COMP', color: '#FF0000' },
        { id: 'family-2', name: 'Mobiliario', code: 'MOB', color: '#00FF00' },
      ])

      const families = await getAccessibleFamilies(context)

      expect(families).toHaveLength(2)
      expect(prisma.families.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        select: { id: true, name: true, code: true, color: true },
        orderBy: { name: 'asc' },
      })
    })

    it('FAMILY_ADMIN: debe retornar familias visibles de inventario', async () => {
      const context = {
        userId: 'admin-1',
        userRole: 'ADMIN' as UserRole,
        isSuperAdmin: false,
      }

      ;(getModuleFamilyIds as jest.Mock).mockResolvedValue(['family-1'])
      ;(prisma.families.findMany as jest.Mock).mockResolvedValue([
        { id: 'family-1', name: 'Computadoras', code: 'COMP', color: '#FF0000' },
      ])

      const families = await getAccessibleFamilies(context)

      expect(families).toHaveLength(1)
      expect(families[0].id).toBe('family-1')
    })

    it('CLIENT: debe retornar array vacío', async () => {
      const context = {
        userId: 'client-1',
        userRole: 'CLIENT' as UserRole,
        isSuperAdmin: false,
      }

      const families = await getAccessibleFamilies(context)

      expect(families).toEqual([])
    })
  })

  describe('createUserContext', () => {
    it('debe crear contexto correctamente desde sesión', () => {
      const session = {
        user: {
          id: 'user-1',
          role: 'ADMIN',
          isSuperAdmin: true,
          canManageInventory: true,
        },
      }

      const context = createUserContext(session)

      expect(context).toEqual({
        userId: 'user-1',
        userRole: 'ADMIN',
        isSuperAdmin: true,
        canManageInventory: true,
      })
    })

    it('debe manejar valores undefined correctamente', () => {
      const session = {
        user: {
          id: 'user-1',
          role: 'CLIENT',
        },
      }

      const context = createUserContext(session)

      expect(context).toEqual({
        userId: 'user-1',
        userRole: 'CLIENT',
        isSuperAdmin: false,
        canManageInventory: false,
      })
    })
  })
})
