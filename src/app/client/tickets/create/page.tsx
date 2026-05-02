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
      <CreateTicketForm
        familiesEndpoint='/api/families'
        clientId={session.user.id}
        afterSuccessHref='/client/tickets'
        cancelHref='/client/tickets'
        submitLabel='Crear Ticket'
        cardTitle='Nueva Solicitud de Soporte'
        cardDescription='Completa el formulario con los detalles de tu problema o solicitud'
        extraData={{
          ...(equipmentId ? { equipmentId } : {}),
        }}
      />
    </ModuleLayout>
  )
}
