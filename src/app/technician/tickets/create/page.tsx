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
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        {/* Formulario Principal */}
        <div className='lg:col-span-2'>
          <CreateTicketForm
            familiesEndpoint='/api/families?asClient=true'
            clientId={session.user.id}
            afterSuccessHref='/technician/tickets'
            cancelHref='/technician/tickets'
            submitLabel='Crear Ticket'
            cardTitle='Crear Ticket de Soporte'
            cardDescription='Describe el problema con el mayor detalle posible para agilizar la resolución'
            showTips={false}
            infoAlert={
              <>
                Estás creando una solicitud como <strong>{session.user.name}</strong>. El ticket
                será asignado a otro técnico o administrador — no puedes atender tus propias
                solicitudes.
              </>
            }
            // No se envía clientId ni assigneeId — el servidor los infiere para TECHNICIAN
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
              La solicitud queda a tu nombre y será atendida por otro técnico o administrador.
            </p>
          </div>
        </div>
      </div>
    </ModuleLayout>
  )
}
