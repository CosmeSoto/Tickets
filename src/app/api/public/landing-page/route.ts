import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const [content, services, banners] = await Promise.all([
      prisma.landing_page_content.findFirst({
        where: { id: 'default' },
      }),
      prisma.landing_page_services.findMany({
        where: { enabled: true },
        orderBy: { order: 'asc' },
      }),
      prisma.landing_page_banners.findMany({
        where: {
          enabled: true,
          OR: [
            { startDate: null, endDate: null },
            {
              AND: [
                { startDate: { lte: new Date() } },
                { endDate: { gte: new Date() } },
              ],
            },
          ],
        },
        orderBy: { order: 'asc' },
      }),
    ])

    return NextResponse.json({
      content: content || {},
      services,
      banners,
    })
  } catch (error) {
    console.error('Error loading landing page:', error)
    return NextResponse.json(
      { error: 'Error al cargar la página' },
      { status: 500 }
    )
  }
}
