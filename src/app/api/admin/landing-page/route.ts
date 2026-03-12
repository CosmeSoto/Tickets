import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const content = await prisma.landing_page_content.findFirst({
      where: { id: 'default' },
    })

    if (!content) {
      // Devolver valores por defecto si no existe contenido
      return NextResponse.json({
        heroTitle: 'Soporte Técnico Profesional',
        heroSubtitle: 'Resolvemos tus problemas técnicos de manera rápida y eficiente',
        heroCtaPrimary: 'Crear Ticket de Soporte',
        heroCtaPrimaryUrl: '/login',
        heroCtaSecondary: 'Ver Servicios',
        heroCtaSecondaryUrl: '#servicios',
        heroImageUrl: '',
        servicesTitle: 'Nuestros Servicios',
        servicesSubtitle: 'Ofrecemos soporte técnico integral',
        servicesEnabled: true,
        companyName: 'Sistema de Tickets',
        companyTagline: 'Soporte técnico profesional',
        companyLogoLightUrl: '',
        companyLogoDarkUrl: '',
        footerText: '© 2024 Sistema de Tickets',
        metaTitle: 'Sistema de Tickets - Soporte Técnico',
        metaDescription: 'Sistema profesional de gestión de tickets',
      })
    }

    // Prisma ya devuelve en camelCase gracias al @map()
    return NextResponse.json({
      heroTitle: content.heroTitle,
      heroSubtitle: content.heroSubtitle,
      heroCtaPrimary: content.heroCtaPrimary,
      heroCtaPrimaryUrl: content.heroCtaPrimaryUrl,
      heroCtaSecondary: content.heroCtaSecondary,
      heroCtaSecondaryUrl: content.heroCtaSecondaryUrl,
      heroImageUrl: content.heroImageUrl || '',
      servicesTitle: content.servicesTitle,
      servicesSubtitle: content.servicesSubtitle,
      servicesEnabled: content.servicesEnabled,
      companyName: content.companyName,
      companyTagline: content.companyTagline,
      companyLogoLightUrl: content.companyLogoLightUrl || '',
      companyLogoDarkUrl: content.companyLogoDarkUrl || '',
      footerText: content.footerText,
      metaTitle: content.metaTitle,
      metaDescription: content.metaDescription,
    })
  } catch (error) {
    console.error('Error loading landing page content:', error)
    return NextResponse.json(
      { error: 'Error al cargar contenido' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    // Usar camelCase (Prisma maneja el mapeo a snake_case automáticamente)
    const content = await prisma.landing_page_content.upsert({
      where: { id: 'default' },
      update: {
        heroTitle: body.heroTitle,
        heroSubtitle: body.heroSubtitle,
        heroCtaPrimary: body.heroCtaPrimary,
        heroCtaPrimaryUrl: body.heroCtaPrimaryUrl,
        heroCtaSecondary: body.heroCtaSecondary,
        heroCtaSecondaryUrl: body.heroCtaSecondaryUrl,
        heroImageUrl: body.heroImageUrl || null,
        servicesTitle: body.servicesTitle,
        servicesSubtitle: body.servicesSubtitle,
        servicesEnabled: body.servicesEnabled,
        companyName: body.companyName,
        companyTagline: body.companyTagline,
        companyLogoLightUrl: body.companyLogoLightUrl || null,
        companyLogoDarkUrl: body.companyLogoDarkUrl || null,
        footerText: body.footerText,
        metaTitle: body.metaTitle,
        metaDescription: body.metaDescription,
        updatedBy: session.user.id,
      },
      create: {
        id: 'default',
        heroTitle: body.heroTitle,
        heroSubtitle: body.heroSubtitle,
        heroCtaPrimary: body.heroCtaPrimary,
        heroCtaPrimaryUrl: body.heroCtaPrimaryUrl,
        heroCtaSecondary: body.heroCtaSecondary,
        heroCtaSecondaryUrl: body.heroCtaSecondaryUrl,
        heroImageUrl: body.heroImageUrl || null,
        servicesTitle: body.servicesTitle,
        servicesSubtitle: body.servicesSubtitle,
        servicesEnabled: body.servicesEnabled,
        companyName: body.companyName,
        companyTagline: body.companyTagline,
        companyLogoLightUrl: body.companyLogoLightUrl || null,
        companyLogoDarkUrl: body.companyLogoDarkUrl || null,
        footerText: body.footerText,
        metaTitle: body.metaTitle,
        metaDescription: body.metaDescription,
        updatedBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, content })
  } catch (error) {
    console.error('Error updating landing page content:', error)
    return NextResponse.json(
      { error: 'Error al actualizar contenido' },
      { status: 500 }
    )
  }
}
