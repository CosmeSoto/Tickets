/**
 * @deprecated Usar POST `/api/admin/users/:id/family-access` { module: 'tickets', familyId }.
 */
import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error:
        'Este endpoint fue retirado. Usa POST /api/admin/users/:userId/family-access con { module: "tickets", familyId }.',
    },
    { status: 410 }
  )
}
