import prisma from '@/lib/prisma'

/**
 * Verifica si un usuario tiene acceso para GESTIONAR (escribir) el inventario.
 * - ADMIN: siempre tiene acceso
 * - TECHNICIAN: tiene acceso si:
 *     a) technician_can_manage_equipment está habilitado Y
 *     b) inventory_technician_ids está vacío (todos los técnicos) O su id está en la lista
 * - CLIENT y otros: nunca tienen acceso de gestión
 */
export async function canManageInventory(userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true
  if (role !== 'TECHNICIAN') return false

  try {
    const [enabledSetting, idsSetting] = await Promise.all([
      prisma.system_settings.findUnique({ where: { key: 'inventory.technician_can_manage_equipment' } }),
      prisma.system_settings.findUnique({ where: { key: 'inventory.inventory_technician_ids' } }),
    ])

    // Si el switch está desactivado, ningún técnico tiene acceso
    const enabled = enabledSetting?.value !== 'false'
    if (!enabled) return false

    // Si no hay lista o está vacía, todos los técnicos tienen acceso
    let allowedIds: string[] = []
    try {
      allowedIds = idsSetting?.value ? JSON.parse(idsSetting.value) : []
    } catch {
      allowedIds = []
    }

    if (allowedIds.length === 0) return true
    return allowedIds.includes(userId)
  } catch {
    return false
  }
}

/**
 * Respuesta estándar de acceso denegado para inventario
 */
export function inventoryForbidden() {
  return Response.json(
    { error: 'No tienes permiso para gestionar el inventario' },
    { status: 403 }
  )
}
