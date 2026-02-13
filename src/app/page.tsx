'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
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
  }, [status, session, router])

  // Mostrar loading mientras se verifica la sesión
  if (status === 'loading') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100'>
        <div className='text-center'>
          <Loader2 className='h-12 w-12 animate-spin text-blue-600 mx-auto mb-4' />
          <p className='text-muted-foreground'>Cargando...</p>
        </div>
      </div>
    )
  }

  // Si está autenticado, mostrar loading mientras redirige
  if (status === 'authenticated') {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100'>
        <div className='text-center'>
          <Loader2 className='h-12 w-12 animate-spin text-blue-600 mx-auto mb-4' />
          <p className='text-muted-foreground'>Redirigiendo a tu dashboard...</p>
        </div>
      </div>
    )
  }

  // Si no está autenticado, mostrar la página de inicio
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100'>
      {/* Header */}
      <header className='bg-card shadow-sm'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex justify-between items-center py-6'>
            <div className='flex items-center'>
              <h1 className='text-2xl font-bold text-foreground'>Sistema de Tickets</h1>
            </div>
            <div className='flex items-center space-x-4'>
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
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className='py-20'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center'>
          <h1 className='text-4xl md:text-6xl font-bold text-foreground mb-6'>
            Soporte Técnico
            <span className='text-blue-600'> Profesional</span>
          </h1>
          <p className='text-xl text-muted-foreground mb-8 max-w-3xl mx-auto'>
            Resolvemos tus problemas técnicos de manera rápida y eficiente. Nuestro equipo
            especializado está disponible para brindarte el mejor soporte.
          </p>
          <div className='flex flex-col sm:flex-row gap-4 justify-center'>
            <Link
              href='/login'
              className='inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700'
            >
              Crear Ticket de Soporte
            </Link>
            <Link
              href='#servicios'
              className='inline-flex items-center px-6 py-3 border border-border text-base font-medium rounded-md text-foreground bg-card hover:bg-muted'
            >
              Ver Servicios
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id='servicios' className='py-20 bg-card'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold text-foreground mb-4'>Nuestros Servicios</h2>
            <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
              Ofrecemos soporte técnico integral para todas tus necesidades tecnológicas
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
            <div className='text-center p-6 bg-card rounded-lg border border-border shadow-sm hover:shadow-lg transition-shadow'>
              <div className='mx-auto w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4'>
                <svg
                  className='h-6 w-6 text-blue-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold mb-2'>Soporte Hardware</h3>
              <p className='text-muted-foreground'>
                Reparación y mantenimiento de equipos de cómputo, impresoras y dispositivos
              </p>
            </div>

            <div className='text-center p-6 bg-card rounded-lg border border-border shadow-sm hover:shadow-lg transition-shadow'>
              <div className='mx-auto w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4'>
                <svg
                  className='h-6 w-6 text-green-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
                  />
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold mb-2'>Soporte Software</h3>
              <p className='text-muted-foreground'>
                Instalación, configuración y resolución de problemas de aplicaciones y sistemas
              </p>
            </div>

            <div className='text-center p-6 bg-card rounded-lg border border-border shadow-sm hover:shadow-lg transition-shadow'>
              <div className='mx-auto w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4'>
                <svg
                  className='h-6 w-6 text-orange-600'
                  fill='none'
                  viewBox='0 0 24 24'
                  stroke='currentColor'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0'
                  />
                </svg>
              </div>
              <h3 className='text-xl font-semibold mb-2'>Redes y Conectividad</h3>
              <p className='text-muted-foreground'>
                Configuración de redes, conexiones a internet y solución de problemas de
                conectividad
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className='bg-gray-900 text-white py-12'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='text-center'>
            <h3 className='text-2xl font-bold mb-4'>Sistema de Tickets</h3>
            <p className='text-muted-foreground mb-8'>Soporte técnico profesional para centro comercial</p>
            <div className='border-t border-gray-800 pt-8'>
              <p className='text-muted-foreground'>
                © 2024 Sistema de Tickets. Todos los derechos reservados.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
