'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export type ActionResult<T = void> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string }

/**
 * Wrapper para server actions que maneja autenticación y errores de forma uniforme.
 * Elimina el patrón try/catch repetido en todas las actions.
 */
export async function withAuth<T>(
  handler: (userId: string) => Promise<T>,
  options?: { successMessage?: string }
): Promise<ActionResult<T>> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return { success: false, error: 'No autorizado' }
    }

    const data = await handler(session.user.id)
    return {
      success: true,
      data,
      ...(options?.successMessage ? { message: options.successMessage } : {}),
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error inesperado'
    console.error('[Action Error]', message)
    return { success: false, error: message }
  }
}
