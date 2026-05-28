/**
 * API: Admin - Forms Management
 * GET /api/admin/forms
 * POST /api/admin/forms
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const forms = await prisma.forms.findMany({
      include: {
        category: true,
        family: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { form_downloads: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ forms })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ forms: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const data = await request.json()
    const form = await prisma.forms.create({
      data: {
        title: data.title,
        slug: data.title.toLowerCase().replace(/\s+/g, '-').substring(0, 200) + '-' + Date.now(),
        description: data.description,
        categoryId: data.categoryId,
        createdById: session.user.id,
      },
    })
    return NextResponse.json({ form })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Error al crear' }, { status: 500 })
  }
}
