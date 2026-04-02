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
   * Valida que el receptor de una asignación pertenezca al mismo departamento que el equipo.
   * Siempre valida: equipment.departmentId es NOT NULL por diseño.
   * Retorna { valid: false, requiredDeptName, receiverDeptName } si los departamentos difieren.
   */
  static async validateAssignmentDepartment(
    equipmentId: string,
    receiverId: string
  ): Promise<{ valid: boolean; requiredDeptName?: string; receiverDeptName?: string }> {
    const [equipment, receiver] = await Promise.all([
      (prisma as any).equipment.findUnique({
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

    const equipmentDeptId: string | null = (equipment as any).departmentId ?? null
    const receiverDeptId: string | null = receiver.departmentId ?? null

    if (equipmentDeptId === receiverDeptId) {
      return { valid: true }
    }

    const requiredDeptName: string | undefined = (equipment as any).department?.name
    const receiverDeptName: string | undefined = (receiver as any).departments?.name

    return { valid: false, requiredDeptName, receiverDeptName }
  }

  /**
   * Retorna el scope de gestión de un gestor de inventario.
   * Prioridad: si tiene inventory_manager_families → type "family".
   * Si solo tiene inventory_manager_departments → type "departments".
   * Si ninguno → type "none".
   */
  static async getManagerScope(managerId: string): Promise<ManagerScope> {
    // 1. Consultar inventory_manager_families
    const familyAssignments = await (prisma as any).inventory_manager_families.findMany({
      where: { managerId },
      include: {
        family: {
          include: {
            departments: {
              where: { isActive: true },
              select: { id: true },
            },
          },
        },
      },
    })

    if (familyAssignments.length > 0) {
      const familyIds: string[] = familyAssignments.map((fa: any) => fa.familyId as string)
      const departmentIds: string[] = familyAssignments.flatMap(
        (fa: any) => (fa.family?.departments ?? []).map((d: any) => d.id as string)
      )
      return { type: 'family', familyIds, departmentIds }
    }

    // 2. Consultar inventory_manager_departments
    const deptAssignments = await (prisma as any).inventory_manager_departments.findMany({
      where: { managerId },
      include: {
        department: {
          select: { id: true, familyId: true },
        },
      },
    })

    if (deptAssignments.length > 0) {
      const departmentIds: string[] = deptAssignments.map((da: any) => da.departmentId as string)
      const familyIdSet = new Set<string>(
        deptAssignments
          .map((da: any) => da.department?.familyId as string | null)
          .filter((fid: string | null): fid is string => fid !== null)
      )
      return { type: 'departments', familyIds: Array.from(familyIdSet), departmentIds }
    }

    // 3. Sin asignaciones
    return { type: 'none', familyIds: [], departmentIds: [] }
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
