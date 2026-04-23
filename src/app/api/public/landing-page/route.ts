import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { withCache, invalidateCache } from '@/lib/api-cache'

export async function GET() {
  try {
    const data = await withCache('landing:page', 1800, async () => {
      const [content, services, banners] = await Promise.all([
        prisma.landing_page_content.findFirst({ where: { id: 'default' } }),
        prisma.landing_page_services.findMany({
          where: { enabled: true },
          orderBy: { order: 'asc' },
        }),
        prisma.landing_page_banners.findMany({
          where: {
            enabled: true,
            OR: [
              { startDate: null, endDate: null },
              { AND: [{ startDate: { lte: new Date() } }, { endDate: { gte: new Date() } }] },
            ],
          },
          orderBy: { order: 'asc' },
        }),
      ])
      return { content: content || {}, services, banners }
    })

    return NextResponse.json(data, {
      headers: {
        // Browser puede cachear 5 min, CDN/proxy 30 min
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('Error loading landing page:', error)
    return NextResponse.json({ error: 'Error al cargar la página' }, { status: 500 })
  }
}

// Exportar para invalidar desde el admin cuando se actualiza la landing
export { invalidateCache }
