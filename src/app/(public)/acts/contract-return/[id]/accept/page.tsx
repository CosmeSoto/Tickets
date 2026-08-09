import { notFound } from 'next/navigation'
import { AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContractReturnAcceptanceForm } from '@/components/inventory/contract-return-acceptance-form'
import {
  PAYMENT_METHOD_TYPE_LABELS,
  getServiceSubtypeLabel,
  type PaymentMethodType,
} from '@/types/contracts'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

async function getAct(id: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const res = await fetch(
    `${baseUrl}/api/inventory/contract-return-acts/${id}?token=${encodeURIComponent(token)}`,
    { cache: 'no-store' }
  )
  if (!res.ok) return null
  return res.json()
}

export default async function ContractReturnAcceptPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { token } = await searchParams

  if (!token) {
    return (
      <div className='container max-w-3xl py-10'>
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertTitle>Token requerido</AlertTitle>
          <AlertDescription>Usa el enlace completo que te enviaron para firmar el acta.</AlertDescription>
        </Alert>
      </div>
    )
  }

  const data = await getAct(id, token)
  if (!data?.act) notFound()

  const { act, canAccept, isExpired } = data
  const snap = act.contractSnapshot as Record<string, unknown>

  return (
    <div className='min-h-screen bg-background'>
      <div className='container max-w-3xl py-8 space-y-6'>
        <div>
          <h1 className='text-2xl font-bold'>Acta de retiro — Suscripción</h1>
          <p className='text-muted-foreground font-mono text-sm mt-1'>{act.folio}</p>
        </div>

        {act.status === 'ACCEPTED' && (
          <Alert className='border-green-500 bg-green-50'>
            <CheckCircle className='h-4 w-4 text-green-600' />
            <AlertTitle>Acta aceptada</AlertTitle>
            <AlertDescription>El retiro quedó registrado correctamente.</AlertDescription>
          </Alert>
        )}

        {(isExpired || act.status === 'EXPIRED') && (
          <Alert variant='destructive'>
            <Clock className='h-4 w-4' />
            <AlertTitle>Acta expirada</AlertTitle>
            <AlertDescription>Solicita una nueva acta al administrador.</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Datos contractuales y financieros</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-3 sm:grid-cols-2 text-sm'>
            <div>
              <p className='text-muted-foreground'>Contrato</p>
              <p className='font-medium'>{String(snap.name ?? '—')}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>N° contrato</p>
              <p className='font-medium'>{String(snap.contractNumber ?? '—')}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>Tipo de servicio</p>
              <p className='font-medium'>
                {getServiceSubtypeLabel(
                  typeof snap.serviceSubtype === 'string' ? snap.serviceSubtype : null
                )}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground'>Método de pago</p>
              <p className='font-medium'>
                {snap.paymentMethodType
                  ? PAYMENT_METHOD_TYPE_LABELS[snap.paymentMethodType as PaymentMethodType]
                  : '—'}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground'>Costo mensual</p>
              <p className='font-medium'>
                {snap.monthlyCost != null
                  ? `${snap.monthlyCost} ${String(snap.currency ?? '')}`
                  : '—'}
              </p>
            </div>
            <div>
              <p className='text-muted-foreground'>Email facturación</p>
              <p className='font-medium'>{String(snap.billingAccountEmail ?? '—')}</p>
            </div>
            {act.withdrawalReason && (
              <div className='sm:col-span-2'>
                <p className='text-muted-foreground'>Motivo del retiro</p>
                <p className='font-medium'>{act.withdrawalReason}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {canAccept && act.status === 'PENDING' && (
          <ContractReturnAcceptanceForm actId={id} token={token} />
        )}
      </div>
    </div>
  )
}
