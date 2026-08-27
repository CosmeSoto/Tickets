import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'

/**
 * GET /api/inventory/contracts/clients?familyId=
 *
 * Candidatos para "Responsable operativo" del contrato (contract_assignments):
 *   - Clientes externos (portal): requieren acceso explícito al área
 *     (user_family_access, module='tickets', canConsume=true) — igual que antes.
 *   - Personal interno (Admin/Técnico) del área: califica automáticamente por
 *     pertenecer al departamento de la familia, sin permiso adicional — mismo
 *     criterio que /api/inventory/assignable-users (asignación de activos).
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (!(await canManageInventory(session.user.id, session.user.role))) {
    return inventoryForbidden()
  }

  const familyId = request.nextUrl.searchParams.get('familyId')
  if (!familyId) {
    return NextResponse.json({ error: 'familyId es requerido' }, { status: 400 })
  }

  const [accessRows, staffUsers] = await Promise.all([
    prisma.user_family_access.findMany({
      where: { familyId, module: 'tickets', isActive: true, canConsume: true },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.users.findMany({
      where: {
        isActive: true,
        role: { in: ['ADMIN', 'TECHNICIAN'] },
        departments: { familyId },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const clientUsers = accessRows.map(a => a.user).filter(c => c.isActive && c.role === 'CLIENT')

  const seen = new Set(clientUsers.map(c => c.id))
  const merged = [
    ...clientUsers,
    ...staffUsers.filter(u => {
      if (seen.has(u.id)) return false
      seen.add(u.id)
      return true
    }),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ clients: merged })
}
