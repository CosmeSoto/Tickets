import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSetting } from '@/lib/api-cache'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  try {
    const value = await getSetting('maxFileSize', 600, '10')
    const maxFileSizeMB = parseInt(value ?? '10') || 10
    return NextResponse.json({ maxFileSizeMB })
  } catch {
    return NextResponse.json({ maxFileSizeMB: 10 })
  }
}
