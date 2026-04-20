import { notFound } from 'next/navigation'
import { AlertCircle, CheckCircle, Clock, Shield } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ActDetailsDisplay } from '@/components/inventory/act-details-display'
import { ActAcceptanceForm } from '@/components/inventory/act-acceptance-form'
import prisma from '@/lib/prisma'
import Image from 'next/image'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

async function getActDetails(id: string, token: string) {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/inventory/acts/${id}?token=${token}`, {
      cache: 'no-store',
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

async function getSystemBranding() {
  try {
    const content = await prisma.landing_page_content.findFirst({ where: { id: 'default' } })
    return {
      companyName: (content as any)?.companyName || 'Sistema de Gestión de Inventario',
      logoUrl: (content as any)?.companyLogoLightUrl || null,
    }
  } catch {
    return { companyName: 'Sistema de Gestión de Inventario', logoUrl: null }
  }
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function ActAcceptancePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { token } = await searchParams

  const [branding] = await Promise.all([getSystemBranding()])

  // Sin token
  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <PublicHeader branding={branding} />
        <div className="container max-w-3xl py-10">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Token requerido</AlertTitle>
            <AlertDescription>
              Esta página requiere un token de acceso válido. Usa el enlace que recibiste por correo electrónico.
            </AlertDescription>
          </Alert>
        </div>
        <PublicFooter branding={branding} />
      </div>
    )
  }

  const data = await getActDetails(id, token)

  if (!data?.act) notFound()

  const { act, canAccept, isExpired } = data

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicHeader branding={branding} act={act} />

      <main className="flex-1 container max-w-3xl py-8 space-y-6">

        {/* Banner de estado */}
        {act.status === 'ACCEPTED' && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-700">Acta aceptada y firmada</AlertTitle>
            <AlertDescription className="text-green-700">
              Aceptada el {fmtDateTime(act.acceptedAt)}. No se requiere ninguna acción adicional.
            </AlertDescription>
          </Alert>
        )}

        {act.status === 'REJECTED' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Acta rechazada</AlertTitle>
            <AlertDescription>
              Rechazada el {fmtDateTime(act.rejectedAt)}.
              {act.rejectionReason && <> Motivo: <strong>{act.rejectionReason}</strong></>}
            </AlertDescription>
          </Alert>
        )}

        {(act.status === 'EXPIRED' || (act.status === 'PENDING' && isExpired)) && (
          <Alert variant="destructive">
            <Clock className="h-4 w-4" />
            <AlertTitle>Acta expirada</AlertTitle>
            <AlertDescription>
              Esta acta expiró el {fmtDate(act.expirationDate)} sin ser firmada.
              Contacta a <strong>{act.delivererInfo?.name}</strong> ({act.delivererInfo?.email}) para que genere una nueva.
            </AlertDescription>
          </Alert>
        )}

        {act.status === 'PENDING' && !isExpired && (
          <Alert className="border-blue-300 bg-blue-50 dark:bg-blue-950">
            <Clock className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Acción requerida</AlertTitle>
            <AlertDescription className="text-blue-700">
              Revisa los detalles del equipo y acepta o rechaza la entrega.
              Esta acta expira el <strong>{fmtDate(act.expirationDate)}</strong>.
            </AlertDescription>
          </Alert>
        )}

        {/* Detalles del acta */}
        <ActDetailsDisplay act={act} showStatus={false} />

        {/* Formulario de aceptación */}
        {canAccept && (
          <ActAcceptanceForm actId={id} token={token} />
        )}

        {/* Ayuda */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>¿Necesitas ayuda?</AlertTitle>
          <AlertDescription>
            Si tienes alguna pregunta, contacta a{' '}
            <strong>{act.delivererInfo?.name}</strong>
            {act.delivererInfo?.email && <> ({act.delivererInfo.email})</>}.
          </AlertDescription>
        </Alert>
      </main>

      <PublicFooter branding={branding} />
    </div>
  )
}

// ── Componentes de layout público ─────────────────────────────────────────────

function PublicHeader({
  branding,
  act,
}: {
  branding: { companyName: string; logoUrl: string | null }
  act?: any
}) {
  return (
    <header className="border-b bg-card">
      <div className="container max-w-3xl py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <div className="relative h-10 w-32">
              <Image
                src={branding.logoUrl}
                alt={branding.companyName}
                fill
                className="object-contain object-left"
                unoptimized
              />
            </div>
          ) : (
            <span className="font-bold text-lg">{branding.companyName}</span>
          )}
        </div>
        {act && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Acta de Entrega</p>
            <p className="font-mono font-semibold text-sm">{act.folio}</p>
          </div>
        )}
      </div>
    </header>
  )
}

function PublicFooter({ branding }: { branding: { companyName: string } }) {
  return (
    <footer className="border-t mt-8">
      <div className="container max-w-3xl py-5 text-center text-xs text-muted-foreground space-y-1">
        <p>{branding.companyName}</p>
        <p className="flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" />
          Página segura — tu aceptación queda registrada con firma digital (IP, fecha y hora)
        </p>
      </div>
    </footer>
  )
}
