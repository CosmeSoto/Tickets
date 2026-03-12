'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import * as Icons from 'lucide-react'
import { SystemLogo } from '@/components/common/system-logo'

interface LandingContent {
  heroTitle: string
  heroSubtitle: string
  heroCtaPrimary: string
  heroCtaPrimaryUrl: string
  heroCtaSecondary: string
  heroCtaSecondaryUrl: string
  heroImageUrl?: string
  servicesTitle: string
  servicesSubtitle: string
  servicesEnabled: boolean
  companyName: string
  companyLogoLightUrl?: string
  companyLogoDarkUrl?: string
  footerText: string
}

interface Service {
  id: string
  icon: string
  iconColor: string
  title: string
  description: string
}

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === 'true'
  const [content, setContent] = useState<LandingContent | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Cargar contenido del CMS
    fetch('/api/public/landing-page')
      .then((res) => res.json())
      .then((data) => {
        setContent(data.content)
        setServices(data.services)
      })
      .catch((error) => console.error('Error loading content:', error))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    // Si es preview, no redirigir
    if (isPreview) return

    // Si el usuario está autenticado, redirigir a su dashboard
    if (status === 'authenticated' && session?.user) {
      const role = session.user.role
      let redirectUrl = '/'

      switch (role) {
        case 'ADMIN':
          redirectUrl = '/admin'
          break
        case 'TECHNICIAN':
          redirectUrl = '/technician'
          break
        case 'CLIENT':
          redirectUrl = '/client'
          break
        default:
          redirectUrl = '/login'
      }

      router.push(redirectUrl)
    }
  }, [status, session, router, isPreview])

  // Mostrar loading mientras se verifica la sesión o carga contenido
  if (status === 'loading' || loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <div className='text-center'>
          <Loader2 className='h-12 w-12 animate-spin text-blue-600 mx-auto mb-4' />
          <p className='text-muted-foreground'>Cargando...</p>
        </div>
      </div>
    )
  }

  // Si está autenticado y NO es preview, mostrar loading mientras redirige
  if (status === 'authenticated' && !isPreview) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
        <div className='text-center'>
          <Loader2 className='h-12 w-12 animate-spin text-blue-600 mx-auto mb-4' />
          <p className='text-muted-foreground'>Redirigiendo a tu dashboard...</p>
        </div>
      </div>
    )
  }

  // Si no hay contenido, mostrar por defecto
  const displayContent = content || {
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
    companyLogoLightUrl: '',
    companyLogoDarkUrl: '',
    footerText: '© 2024 Sistema de Tickets',
  }

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName] || Icons.HelpCircle
    return Icon
  }

  // Si no está autenticado, mostrar la página de inicio
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800'>
      {/* Header */}
      <header className='bg-card shadow-sm border-b border-border'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <SystemLogo size="md" showText={true} />
            <div className='flex items-center space-x-4'>
              {status === 'authenticated' && session?.user ? (
                <>
                  <Link
                    href={
                      session.user.role === 'ADMIN' 
                        ? '/admin' 
                        : session.user.role === 'TECHNICIAN' 
                        ? '/technician' 
                        : '/client'
                    }
                    className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700'
                  >
                    Ir al Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href='/login'
                    className='inline-flex items-center px-4 py-2 border border-border rounded-md shadow-sm text-sm font-medium text-foreground bg-card hover:bg-muted'
                  >
                    Iniciar Sesión
                  </Link>
                  <Link
                    href='/login'
                    className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700'
                  >
                    Crear Ticket
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className='py-20 relative'
        style={
          displayContent.heroImageUrl 
            ? {
                backgroundImage: `url(${displayContent.heroImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        {displayContent.heroImageUrl && (
          <div className='absolute inset-0 bg-black/50 dark:bg-black/70'></div>
        )}
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10'>
          <h1 className={`text-4xl md:text-6xl font-bold mb-6 ${displayContent.heroImageUrl ? 'text-white' : 'text-foreground'}`}>
            {displayContent.heroTitle.split(' ').slice(0, -1).join(' ')}{' '}
            <span className={displayContent.heroImageUrl ? 'text-blue-300' : 'text-blue-600 dark:text-blue-400'}>
              {displayContent.heroTitle.split(' ').slice(-1)}
            </span>
          </h1>
          <p className={`text-xl mb-8 max-w-3xl mx-auto ${displayContent.heroImageUrl ? 'text-gray-100' : 'text-muted-foreground'}`}>
            {displayContent.heroSubtitle}
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            <Link
              href={displayContent.heroCtaPrimaryUrl}
              className='inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
            >
              {displayContent.heroCtaPrimary}
            </Link>
            <Link
              href={displayContent.heroCtaSecondaryUrl}
              className={`inline-flex items-center px-6 py-3 border text-base font-medium rounded-md ${
                displayContent.heroImageUrl 
                  ? 'border-white text-white bg-white/10 hover:bg-white/20' 
                  : 'border-border text-foreground bg-card hover:bg-muted'
              }`}
            >
              {displayContent.heroCtaSecondary}
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      {displayContent.servicesEnabled && services.length > 0 && (
        <section id='servicios' className='py-20 bg-card border-y border-border'>
          <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center mb-16'>
              <h2 className='text-3xl font-bold text-foreground mb-4'>{displayContent.servicesTitle}</h2>
              <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
                {displayContent.servicesSubtitle}
              </p>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
              {services.map((service) => {
                const Icon = getIcon(service.icon)
                const colorClass = {
                  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
                  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
                  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
                  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                }[service.iconColor] || 'bg-blue-100 text-blue-600'

                return (
                  <div
                    key={service.id}
                    className='text-center p-6 bg-card rounded-lg border border-border shadow-sm hover:shadow-lg transition-shadow'
                  >
                    <div className={`mx-auto w-12 h-12 ${colorClass} rounded-lg flex items-center justify-center mb-4`}>
                      <Icon className='h-6 w-6' />
                    </div>
                    <h3 className='text-xl font-semibold mb-2 text-foreground'>{service.title}</h3>
                    <p className='text-muted-foreground'>{service.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className='bg-gray-900 dark:bg-gray-950 text-white py-12 border-t border-gray-800'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center'>
            <h3 className='text-2xl font-bold mb-4'>{displayContent.companyName}</h3>
            <div className='border-t border-gray-800 pt-8'>
              <p className='text-gray-400'>{displayContent.footerText}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
