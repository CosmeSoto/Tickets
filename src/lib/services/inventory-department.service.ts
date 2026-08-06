import { prisma } from '@/lib/prisma'

export interface ManagerScope {
  type: 'family' | 'departments' | 'none'
  familyIds: string[]
  departmentIds: string[]
}

/**
 * Servicio central para la lógica de jerarquía departamento-equipo en inventarios.
 * Implementa las reglas de negocio de la jerarquía Familia → Departamento → Equipo.
 */
export class InventoryDepartmentService {
  /**
   * Valida departamento del receptor vs equipo.
   *
   * Reglas (flujo Compras → área → persona):
   * - Equipo sin departamento o AVAILABLE en bodega Compras: entrega cross-área permitida.
   * - Equipo ya en custodia de un departamento: receptor debe ser del mismo departamento.
   */
  static async validateAssignmentDepartment(
    equipmentId: string,
    receiverId: string
  ): Promise<{ valid: boolean; requiredDeptName?: string; receiverDeptName?: string }> {
    const [equipment, receiver] = await Promise.all([
      prisma.equipment.findUnique({
        where: { id: equipmentId },
        include: { department: true },
      }),
      prisma.users.findUnique({
        where: { id: receiverId },
        include: { departments: true },
      }),
    ])

    if (!equipment) {
      throw new Error('Equipo no encontrado')
    }

    if (!receiver) {
      throw new Error('Usuario receptor no encontrado')
    }

    const equipmentDeptId = equipment.departmentId ?? null

    // Bodega Compras / sin departamento: entrega a otra área
    if (!equipmentDeptId || equipment.status === 'AVAILABLE') {
      return { valid: true }
    }

    const receiverDeptId = receiver.departmentId ?? null

    if (equipmentDeptId === receiverDeptId) {
      return { valid: true }
    }

    return {
      valid: false,
      requiredDeptName: equipment.department?.name,
      receiverDeptName: receiver.departments?.name,
    }
  }

  /**
   * Scope de gestión del gestor (asistente Compras, etc.).
   * Deriva departamentos accesibles desde user_family_access (módulo inventory) + familia nativa.
   */
  static async getManagerScope(managerId: string): Promise<ManagerScope> {
    const { getInventoryOperationalFamilyIds } = await import('@/lib/auth/family-scope')

    const user = await prisma.users.findUnique({
      where: { id: managerId },
      select: { role: true, canManageInventory: true, departments: { select: { familyId: true } } },
    })

    const canManage = user?.canManageInventory === true
    const familyIds =
      (await getInventoryOperationalFamilyIds(
        managerId,
        user?.role ?? 'TECHNICIAN',
        false,
        canManage
      )) ?? []

    if (familyIds.length === 0) {
      return { type: 'none', familyIds: [], departmentIds: [] }
    }

    const departments = await prisma.departments.findMany({
      where: { familyId: { in: familyIds }, isActive: true },
      select: { id: true },
    })

    return {
      type: 'family',
      familyIds,
      departmentIds: departments.map(d => d.id),
    }
  }

  /**
   * Retorna los IDs de departamento accesibles para un gestor.
   * Derivado de getManagerScope.
   */
  static async getAccessibleDepartmentIds(managerId: string): Promise<string[]> {
    const scope = await InventoryDepartmentService.getManagerScope(managerId)
    return scope.departmentIds
  }

  /**
   * Retorna la familia derivada de un equipo (a través de su departamento).
   * Retorna null si el equipo no tiene departmentId o el departamento no tiene familyId.
   */
  static async getDerivedFamily(
    equipmentId: string
  ): Promise<{ id: string; name: string; code: string } | null> {
    const equipment = await (prisma as any).equipment.findUnique({
      where: { id: equipmentId },
      include: {
        department: {
          include: {
            family: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    })

    if (!equipment) return null

    const family = (equipment as any).department?.family ?? null
    if (!family) return null

    return { id: family.id, name: family.name, code: family.code }
  }
}
