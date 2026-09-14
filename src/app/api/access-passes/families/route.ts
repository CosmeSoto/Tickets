import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireAccessPermission } from '@/lib/access/access-control'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { denied, permission } = await requireAccessPermission(session.user.id, 'manage')
  if (denied) return denied
  const families = await prisma.families.findMany({
    where: {
      isActive: true,
      ...(permission.familyIds ? { id: { in: permission.familyIds } } : {}),
    },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ families })
}
