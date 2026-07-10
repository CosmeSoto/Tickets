import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth/require-super-admin'

/** Backups y restauración: solo Super Administrador (isSuperAdmin en BD). */
export async function requireBackupSuperAdmin() {
  const session = await getServerSession(authOptions)
  const check = await requireSuperAdmin(session)
  if (!check.ok) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: check.error }, { status: check.status }),
    }
  }
  return { session, errorResponse: null }
}
