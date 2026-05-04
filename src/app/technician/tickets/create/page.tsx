'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { CreateTicketForm } from '@/components/tickets/create-ticket-form'

export default function TechnicianCreateTicketPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'TECHNICIAN') {
      router.push('/unauthorized')
      return
    }
  }, [session, status, router])

  if (status === 'loading' || !session) {
    return (
      <ModuleLayout title='Crear Ticket' subtitle='Cargando...' loading={true}>
        <div />
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
      title='Crear Ticket'
      subtitle='Tu solicitud será atendida por otro técnico o administrador'
      headerActions={
        <Button variant='outline' size='sm' asChild>
          <Link href='/technician/tickets'>
            <ArrowLeft className='h-4 w-4 mr-2' />
            Volver
          </Link>
        </Button>
      }
    >
      <CreateTicketForm
        familiesEndpoint='/api/families?asClient=true'
        clientId={session.user.id}
        afterSuccessHref='/technician/tickets'
        cancelHref='/technician/tickets'
        submitLabel='Crear Ticket'
        cardTitle='Crear Ticket de Soporte'
        cardDescription='Describe el problema con el mayor detalle posible para agilizar la resolución'
        infoAlert={
          <>
            Estás creando una solicitud como <strong>{session.user.name}</strong>. El ticket será
            asignado a otro técnico o administrador — no puedes atender tus propias solicitudes.
          </>
        }
        // No se envía clientId ni assigneeId — el servidor los infiere para TECHNICIAN
      />
    </ModuleLayout>
  )
}
