import prisma from '@/lib/prisma'

/**
 * Verifica si un usuario tiene acceso para GESTIONAR (escribir) el inventario.
 * - ADMIN: siempre tiene acceso
 * - Cualquier otro rol: solo si su userId está en `inventory.manager_ids`
 * - Si la lista está vacía → solo el ADMIN tiene acceso (sin fallback a todos)
 */
export async function canManageInventory(userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true

  try {
    const managersSetting = await prisma.system_settings.findUnique({
      where: { key: 'inventory.manager_ids' },
    })

    let managerIds: string[] = []
    try {
      managerIds = managersSetting?.value ? JSON.parse(managersSetting.value) : []
    } catch {
      managerIds = []
    }

    // Si la lista está vacía, solo el ADMIN tiene acceso
    if (managerIds.length === 0) return false

    return managerIds.includes(userId)
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
