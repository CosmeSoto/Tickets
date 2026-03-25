import { notFound, redirect } from 'next/navigation'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ActDetailsDisplay } from '@/components/inventory/act-details-display'
import { ActAcceptanceForm } from '@/components/inventory/act-acceptance-form'

interface PageProps {
  params: {
    id: string
  }
  searchParams: {
    token?: string
  }
}

async function getActDetails(id: string, token: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/inventory/acts/${id}?token=${token}`, {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching act:', error)
    return null
  }
}

export default async function ActAcceptancePage({ params, searchParams }: PageProps) {
  const { id } = params
  const { token } = searchParams

  // Validar que se proporcione el token
  if (!token) {
    return (
      <div className="container max-w-4xl py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Token Requerido</AlertTitle>
          <AlertDescription>
            Esta página requiere un token de acceso válido. Por favor, utiliza el enlace proporcionado en tu correo electrónico.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // Obtener detalles del acta
  const data = await getActDetails(id, token)

  if (!data || !data.act) {
    notFound()
  }

  const { act, canAccept, isExpired } = data

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container max-w-4xl py-6">
          <h1 className="text-3xl font-bold">Acta de Entrega</h1>
          <p className="text-muted-foreground mt-2">
            Revisa los detalles del equipo y acepta o rechaza la entrega
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl py-8 space-y-8">
        {/* Alertas de Estado */}
        {act.status === 'ACCEPTED' && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-600">Acta Aceptada</AlertTitle>
            <AlertDescription className="text-green-600">
              Esta acta ya ha sido aceptada el{' '}
              {new Date(act.acceptedAt!).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              . No se requiere ninguna acción adicional.
            </AlertDescription>
          </Alert>
        )}

        {act.status === 'REJECTED' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acta Rechazada</AlertTitle>
            <AlertDescription>
              Esta acta fue rechazada el{' '}
              {new Date(act.rejectedAt!).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              .
              {act.rejectionReason && (
                <>
                  <br />
                  <strong>Razón:</strong> {act.rejectionReason}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {act.status === 'EXPIRED' && (
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertTitle>Acta Expirada</AlertTitle>
            <AlertDescription>
              Esta acta expiró el{' '}
              {new Date(act.expirationDate).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              . Ya no es posible aceptarla o rechazarla. Por favor, contacta al administrador.
            </AlertDescription>
          </Alert>
        )}

        {act.status === 'PENDING' && isExpired && (
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertTitle>Acta Expirada</AlertTitle>
            <AlertDescription>
              Esta acta expiró el{' '}
              {new Date(act.expirationDate).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              . Ya no es posible aceptarla o rechazarla. Por favor, contacta al administrador.
            </AlertDescription>
          </Alert>
        )}

        {act.status === 'PENDING' && !isExpired && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Acción Requerida</AlertTitle>
            <AlertDescription>
              Esta acta está pendiente de aceptación. Expira el{' '}
              {new Date(act.expirationDate).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
              . Por favor, revisa los detalles y acepta o rechaza la entrega.
            </AlertDescription>
          </Alert>
        )}

        {/* Detalles del Acta */}
        <ActDetailsDisplay act={act} showStatus={false} />

        {/* Formulario de Aceptación (solo si está pendiente y no expirada) */}
        {canAccept && (
          <ActAcceptanceForm actId={id} token={token} />
        )}

        {/* Información de Contacto */}
        <Alert>
          <AlertTitle>¿Necesitas Ayuda?</AlertTitle>
          <AlertDescription>
            Si tienes alguna pregunta o problema con esta acta, por favor contacta a{' '}
            <strong>{act.delivererInfo.name}</strong> ({act.delivererInfo.email}) o al departamento de TI.
          </AlertDescription>
        </Alert>
      </div>

      {/* Footer */}
      <div className="border-t mt-12">
        <div className="container max-w-4xl py-6 text-center text-sm text-muted-foreground">
          <p>Sistema de Gestión de Inventario</p>
          <p className="mt-1">
            Esta es una página segura. Tu aceptación será registrada con firma digital.
          </p>
        </div>
      </div>
    </div>
  )
}
