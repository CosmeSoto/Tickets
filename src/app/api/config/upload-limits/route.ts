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
    const [fileSizeValue, personalImageSizeValue] = await Promise.all([
      getSetting('maxFileSize', 600, '10'),
      getSetting('maxPersonalImageSize', 600, '5'),
    ])
    const maxFileSizeMB = parseInt(fileSizeValue ?? '10') || 10
    const maxPersonalImageSizeMB = parseInt(personalImageSizeValue ?? '5') || 5
    return NextResponse.json({ maxFileSizeMB, maxPersonalImageSizeMB })
  } catch {
    return NextResponse.json({ maxFileSizeMB: 10, maxPersonalImageSizeMB: 5 })
  }
}
