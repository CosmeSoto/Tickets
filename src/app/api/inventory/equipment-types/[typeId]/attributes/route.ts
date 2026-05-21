import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AttributeHandler } from '@/lib/api/attribute-handler'

const handler = new AttributeHandler('equipment')

export async function GET(request: NextRequest, context: { params: Promise<{ typeId: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const params = await context.params
  return handler.getAll(params.typeId)
}
