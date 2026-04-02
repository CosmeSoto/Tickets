import prisma from '@/lib/prisma'

/**
 * Verifica si un usuario tiene acceso para GESTIONAR (escribir) el inventario.
 * - ADMIN: siempre tiene acceso
 * - Cualquier otro rol: solo si users.canManageInventory === true
 *
 * Fuente de verdad única: el campo canManageInventory en la tabla users.
 * Se eliminó la dependencia de system_settings['inventory.manager_ids']
 * para evitar la doble fuente de verdad.
 */
export async function canManageInventory(userId: string, role: string): Promise<boolean> {
  if (role === 'ADMIN') return true

  try {
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { canManageInventory: true, isActive: true },
    })

    if (!user || !user.isActive) return false
    return user.canManageInventory === true
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
