import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedLandingCMS() {
  console.log('🌱 Seeding Landing Page CMS...')

  // 1. Crear contenido principal
  const content = await prisma.landing_page_content.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      heroTitle: 'Soporte Técnico Profesional',
      heroSubtitle: 'Resolvemos tus problemas técnicos de manera rápida y eficiente. Nuestro equipo especializado está disponible para brindarte el mejor soporte.',
      heroCtaPrimary: 'Crear Ticket de Soporte',
      heroCtaSecondary: 'Ver Servicios',
      servicesTitle: 'Nuestros Servicios',
      servicesSubtitle: 'Ofrecemos soporte técnico integral para todas tus necesidades tecnológicas',
      servicesEnabled: true,
      companyName: 'Sistema de Tickets',
      companyTagline: 'Soporte técnico profesional para tu negocio',
      footerText: '© 2024 Sistema de Tickets. Todos los derechos reservados.',
      metaTitle: 'Sistema de Tickets - Soporte Técnico Profesional',
      metaDescription: 'Sistema profesional de gestión de tickets de soporte técnico. Resolvemos tus problemas de manera rápida y eficiente.',
      primaryColor: '#2563eb',
      secondaryColor: '#3b82f6',
      accentColor: '#1e40af',
      primaryColorDark: '#3b82f6',
      secondaryColorDark: '#60a5fa',
      accentColorDark: '#2563eb',
      supportDarkMode: true,
      autoTheme: true,
      showStats: false,
      showTestimonials: false,
      showFaq: false,
    },
  })

  console.log('✅ Contenido principal creado:', content.id)

  // 2. Crear servicios por defecto
  const services = [
    {
      id: 'service-1',
      order: 1,
      enabled: true,
      icon: 'Cpu',
      iconColor: 'blue',
      title: 'Soporte Hardware',
      description: 'Reparación y mantenimiento de equipos de cómputo, impresoras y dispositivos',
    },
    {
      id: 'service-2',
      order: 2,
      enabled: true,
      icon: 'Settings',
      iconColor: 'green',
      title: 'Soporte Software',
      description: 'Instalación, configuración y resolución de problemas de aplicaciones y sistemas',
    },
    {
      id: 'service-3',
      order: 3,
      enabled: true,
      icon: 'Wifi',
      iconColor: 'orange',
      title: 'Redes y Conectividad',
      description: 'Configuración de redes, conexiones a internet y solución de problemas de conectividad',
    },
  ]

  for (const service of services) {
    await prisma.landing_page_services.upsert({
      where: { id: service.id },
      update: {},
      create: service,
    })
  }

  console.log('✅ Servicios creados:', services.length)

  console.log('🎉 Landing Page CMS seeded successfully!')
}

seedLandingCMS()
  .catch((e) => {
    console.error('❌ Error seeding Landing Page CMS:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
