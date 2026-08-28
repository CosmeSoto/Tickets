import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LicenseAssignmentService } from '@/lib/services/license-assignment.service'
import {
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'

/** GET /api/inventory/licenses/[id]/assignments — historial + asignación activa */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params

  try {
    await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'LICENSE', id)
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    throw err
  }

  const assignments = await LicenseAssignmentService.listByLicense(id)
  const active = assignments.find(a => a.isActive) ?? null

  return NextResponse.json({ assignments, active })
}
