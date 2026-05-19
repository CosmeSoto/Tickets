import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

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
        heroTitle: 'Gestión Integral de Operaciones',
        heroSubtitle: 'Tickets, inventario, rondas en una sola plataforma',
        heroCtaPrimary: 'Crear Ticket de Soporte',
        heroCtaPrimaryUrl: '/login',
        heroCtaSecondary: 'Ver Servicios',
        heroCtaSecondaryUrl: '#servicios',
        heroImageUrl: '',
        servicesTitle: 'Nuestros Servicios',
        servicesSubtitle: 'Ofrecemos soporte técnico integral',
        servicesEnabled: true,
        companyName: 'Sistema de Tickets',
        companyTagline: 'Gestión Integral de Operaciones',
        companyLogoLightUrl: '',
        companyLogoDarkUrl: '',
        faviconUrl: '',
        contactEmail: '',
        contactPhone: '',
        contactAddress: '',
        socialFacebook: '',
        socialInstagram: '',
        socialTwitter: '',
        socialLinkedin: '',
        socialWhatsapp: '',
        scheduleText: '',
        footerText: '© 2025 Sistema de Tickets',
        footerLinksJson: '',
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
      faviconUrl: content.faviconUrl || '',
      contactEmail: content.contactEmail || '',
      contactPhone: content.contactPhone || '',
      contactAddress: content.contactAddress || '',
      socialFacebook: content.socialFacebook || '',
      socialInstagram: content.socialInstagram || '',
      socialTwitter: content.socialTwitter || '',
      socialLinkedin: content.socialLinkedin || '',
      socialWhatsapp: content.socialWhatsapp || '',
      scheduleText: content.scheduleText || '',
      footerText: content.footerText,
      footerLinksJson: content.footerLinksJson || '',
      metaTitle: content.metaTitle,
      metaDescription: content.metaDescription,
    })
  } catch (error) {
    console.error('Error loading landing page content:', error)
    return NextResponse.json({ error: 'Error al cargar contenido' }, { status: 500 })
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
        faviconUrl: body.faviconUrl || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        contactAddress: body.contactAddress || null,
        socialFacebook: body.socialFacebook || null,
        socialInstagram: body.socialInstagram || null,
        socialTwitter: body.socialTwitter || null,
        socialLinkedin: body.socialLinkedin || null,
        socialWhatsapp: body.socialWhatsapp || null,
        scheduleText: body.scheduleText || null,
        footerText: body.footerText,
        footerLinksJson: body.footerLinksJson || null,
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
        faviconUrl: body.faviconUrl || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        contactAddress: body.contactAddress || null,
        socialFacebook: body.socialFacebook || null,
        socialInstagram: body.socialInstagram || null,
        socialTwitter: body.socialTwitter || null,
        socialLinkedin: body.socialLinkedin || null,
        socialWhatsapp: body.socialWhatsapp || null,
        scheduleText: body.scheduleText || null,
        footerText: body.footerText,
        footerLinksJson: body.footerLinksJson || null,
        metaTitle: body.metaTitle,
        metaDescription: body.metaDescription,
        updatedBy: session.user.id,
      },
    })

    // Sincronizar también con las otras configuraciones
    const syncPromises: any[] = []

    if (body.contactEmail !== undefined) {
      syncPromises.push(
        prisma.system_settings.upsert({
          where: { key: 'supportEmail' },
          update: { value: body.contactEmail || '', updatedAt: new Date() },
          create: {
            id: randomUUID(),
            key: 'supportEmail',
            value: body.contactEmail || '',
            description: 'Email de contacto para soporte técnico',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )

      syncPromises.push(
        prisma.system_settings.upsert({
          where: { key: 'help.support_email' },
          update: { value: body.contactEmail || '', updatedAt: new Date() },
          create: {
            id: randomUUID(),
            key: 'help.support_email',
            value: body.contactEmail || '',
            description: 'Email de contacto para soporte técnico',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )
    }

    if (body.companyName !== undefined) {
      syncPromises.push(
        prisma.system_settings.upsert({
          where: { key: 'systemName' },
          update: { value: body.companyName || '', updatedAt: new Date() },
          create: {
            id: randomUUID(),
            key: 'systemName',
            value: body.companyName || '',
            description: 'Nombre del sistema',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )

      syncPromises.push(
        prisma.system_settings.upsert({
          where: { key: 'help.company_name' },
          update: { value: body.companyName || '', updatedAt: new Date() },
          create: {
            id: randomUUID(),
            key: 'help.company_name',
            value: body.companyName || '',
            description: 'Nombre de la empresa',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        })
      )
    }

    if (syncPromises.length > 0) {
      await Promise.all(syncPromises)
    }

    // Invalidar caché de landing page
    try {
      const { invalidateCache } = await import('@/lib/api-cache')
      await Promise.all([invalidateCache('landing:page'), invalidateCache('admin:settings')])
    } catch {
      /* Redis no disponible */
    }

    return NextResponse.json({ success: true, content })
  } catch (error) {
    console.error('Error updating landing page content:', error)
    return NextResponse.json({ error: 'Error al actualizar contenido' }, { status: 500 })
  }
}
