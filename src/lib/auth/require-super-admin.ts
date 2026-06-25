import prisma from '@/lib/prisma'

export type SuperAdminCheck =
  | { ok: true }
  | { ok: false; status: number; error: string }

/** Verifica sesión ADMIN + flag isSuperAdmin en BD. */
export async function requireSuperAdmin(session: {
  user?: { id?: string; role?: string }
} | null): Promise<SuperAdminCheck> {
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return { ok: false, status: 401, error: 'No autorizado' }
  }

  const requester = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })

  if (!requester?.isSuperAdmin) {
    return {
      ok: false,
      status: 403,
      error: 'Solo el Super Administrador puede realizar esta acción',
    }
  }

  return { ok: true }
}
