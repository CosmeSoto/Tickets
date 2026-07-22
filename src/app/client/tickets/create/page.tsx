'use client'

import { Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CreateTicketForm } from '@/components/tickets/create-ticket-form'

export default function CreateClientTicketPage() {
  return (
    <Suspense
      fallback={
        <ModuleLayout title='Crear Ticket' subtitle='Nueva solicitud de soporte' loading={true}>
          <div />
        </ModuleLayout>
      }
    >
      <CreateClientTicketContent />
    </Suspense>
  )
}

function CreateClientTicketContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'CLIENT') {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  if (status === 'loading' || !session) {
    return (
      <ModuleLayout title='Crear Ticket' subtitle='Nueva solicitud de soporte' loading={true}>
        <div />
      </ModuleLayout>
    )
  }

  // Parámetros opcionales desde query string (ej: reporte de equipo)
  const preTitle = searchParams.get('title') || undefined
  const preDescription = searchParams.get('description') || undefined
  const preLocation = searchParams.get('location') || undefined
  const equipmentId = searchParams.get('equipmentId') || undefined

  return (
    <ModuleLayout
      title='Crear Ticket'
      subtitle='Describe tu problema o solicitud'
      headerActions={
        <Button variant='outline' size='sm' asChild>
          <Link href='/client/tickets'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            <span className='hidden sm:inline'>Volver a Mis Tickets</span>
            <span className='sm:hidden'>Volver</span>
          </Link>
        </Button>
      }
    >
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Formulario Principal */}
        <div className='lg:col-span-2'>
          <CreateTicketForm
            familiesEndpoint='/api/families?asClient=true'
            clientId={session.user.id}
            afterSuccessHref='/client/tickets'
            cancelHref='/client/tickets'
            submitLabel='Crear Ticket'
            cardTitle='Nueva Solicitud de Soporte'
            showTips={false}
            extraData={{
              ...(equipmentId ? { equipmentId } : {}),
            }}
          />
        </div>

        {/* Sidebar */}
        <div className='space-y-6'>
          <div className='border rounded-lg p-3 bg-muted/20'>
            <p className='text-xs font-semibold text-muted-foreground mb-1.5'>Consejos rápidos</p>
            <ul className='text-xs text-muted-foreground space-y-0.5'>
              <li>• Elige primero el área de soporte</li>
              <li>• Usa un título claro y descriptivo</li>
              <li>• Describe el problema con detalles</li>
              <li>• Adjunta fotos o capturas si aplica</li>
            </ul>
          </div>
          <div className='border rounded-lg p-3 bg-muted/10'>
            <p className='text-xs font-semibold text-muted-foreground mb-1'>Nota</p>
            <p className='text-xs text-muted-foreground'>
              Este ticket se registrará como tu solicitud y quedará asociado a tu cuenta.
            </p>
          </div>
        </div>
      </div>
    </ModuleLayout>
  )
}
