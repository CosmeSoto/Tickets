import { NextResponse } from 'next/server'
import { getPgBackRestRestoreStatus } from '@/lib/services/backup/backup-engine'
import { requireBackupSuperAdmin } from '../_auth'

export async function GET() {
  try {
    const { errorResponse } = await requireBackupSuperAdmin()
    if (errorResponse) return errorResponse

    const status = await getPgBackRestRestoreStatus()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error fetching restore status:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'No se pudo consultar el estado de restauración',
      },
      { status: 500 }
    )
  }
}
