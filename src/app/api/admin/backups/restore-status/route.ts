import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPgBackRestRestoreStatus } from '@/lib/services/backup/backup-engine'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

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
