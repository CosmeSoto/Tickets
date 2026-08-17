'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock3, Loader2, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatAccessDateTime } from '@/lib/access/access-dates'

type PublicPass = {
  credentialCode: string
  status: string
  validFrom: string
  validUntil: string
  acceptedAt?: string | null
  expiresAt?: string | null
  subject: {
    firstName: string
    lastName: string
    organization?: string | null
    accessType: string
    privacyNoticeVersion?: string | null
  }
  family: { name: string }
}

export function PrivacyAcceptance({ passId, token }: { passId: string; token: string }) {
  const [pass, setPass] = useState<PublicPass | null>(null)
  const [canAccept, setCanAccept] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setMessage('Este enlace de aceptación no es válido.')
      setLoading(false)
      return
    }
    void fetch(`/api/access-passes/${passId}/accept?token=${encodeURIComponent(token)}`)
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No fue posible consultar la credencial.')
        setPass(data.pass)
        setCanAccept(Boolean(data.canAccept))
        if (data.expired)
          setMessage('Este enlace de aceptación expiró. Solicita uno nuevo al área emisora.')
      })
      .catch(error => setMessage(error instanceof Error ? error.message : 'Enlace no disponible.'))
      .finally(() => setLoading(false))
  }, [passId, token])

  const confirm = async () => {
    setSubmitting(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/access-passes/${passId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accepted: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'No se pudo registrar la aceptación.')
      setCanAccept(false)
      setMessage(data.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo registrar la aceptación.')
    } finally {
      setSubmitting(false)
    }
  }

  const date = (value: string) => formatAccessDateTime(value)
  return (
    <main className='min-h-screen bg-muted/30 px-4 py-10'>
      <section className='mx-auto max-w-xl rounded-xl border bg-card p-6 shadow-sm space-y-6'>
        <div className='flex items-start gap-3'>
          <ShieldCheck className='h-8 w-8 text-primary shrink-0' />
          <div>
            <h1 className='text-xl font-semibold'>Activación de credencial de acceso</h1>
            <p className='text-sm text-muted-foreground mt-1'>
              Revisa el aviso de privacidad antes de recibir tu código QR.
            </p>
          </div>
        </div>
        {loading && (
          <div className='flex justify-center py-10'>
            <Loader2 className='animate-spin' />
          </div>
        )}
        {!loading && message && !pass && (
          <Alert variant='destructive'>
            <AlertTitle>Enlace no disponible</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        {!loading && pass && (
          <>
            <div className='rounded-lg border bg-muted/30 p-4 text-sm space-y-2'>
              <p>
                <span className='text-muted-foreground'>Persona:</span> {pass.subject.firstName}{' '}
                {pass.subject.lastName}
              </p>
              <p>
                <span className='text-muted-foreground'>Área:</span> {pass.family.name}
              </p>
              {pass.subject.organization && (
                <p>
                  <span className='text-muted-foreground'>Arrendatario:</span>{' '}
                  {pass.subject.organization}
                </p>
              )}
              <p>
                <span className='text-muted-foreground'>Vigencia:</span> {date(pass.validFrom)} —{' '}
                {date(pass.validUntil)}
              </p>
            </div>
            {canAccept ? (
              <div className='space-y-4'>
                <p className='text-sm'>
                  Te informamos que tus datos serán tratados para gestionar y verificar este acceso.
                  Consulta el{' '}
                  <Link
                    href='/help/privacy'
                    target='_blank'
                    className='text-primary underline underline-offset-4'
                  >
                    aviso de privacidad (versión {pass.subject.privacyNoticeVersion || 'vigente'})
                  </Link>
                  .
                </p>
                <label className='flex items-start gap-3 rounded-lg border p-4 cursor-pointer'>
                  <Checkbox
                    checked={accepted}
                    onCheckedChange={value => setAccepted(value === true)}
                  />
                  <span className='text-sm leading-relaxed'>
                    He leído y acepto el aviso de privacidad para la gestión de esta credencial de
                    acceso.
                  </span>
                </label>
                <Button className='w-full' disabled={!accepted || submitting} onClick={confirm}>
                  {submitting ? (
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  ) : (
                    <CheckCircle2 className='mr-2 h-4 w-4' />
                  )}
                  Aceptar y activar credencial
                </Button>
              </div>
            ) : (
              <Alert className={message ? 'border-emerald-500/40' : ''}>
                {message ? (
                  <CheckCircle2 className='h-4 w-4 text-emerald-600' />
                ) : (
                  <Clock3 className='h-4 w-4' />
                )}
                <AlertTitle>
                  {message ? 'Aceptación registrada' : 'Credencial no disponible para aceptar'}
                </AlertTitle>
                <AlertDescription>
                  {message || 'Solicita ayuda al área que emitió la credencial.'}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </section>
    </main>
  )
}
