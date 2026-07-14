'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

interface Props {
  actId: string
  token: string
}

export function ContractReturnAcceptanceForm({ actId, token }: Props) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const handleAccept = async () => {
    if (!accepted) {
      toast({ title: 'Debes confirmar la recepción', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/inventory/contract-return-acts/${actId}/accept?token=${encodeURIComponent(token)}`,
        { method: 'POST' }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'No se pudo aceptar el acta')
      toast({ title: 'Acta de retiro aceptada' })
      window.location.reload()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirmar retiro de suscripción</CardTitle>
        <CardDescription>
          Al aceptar, confirmas la devolución del servicio y los datos contractuales/financieros
          registrados en el acta.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-start gap-2'>
          <Checkbox id='accept-return' checked={accepted} onCheckedChange={v => setAccepted(!!v)} />
          <Label htmlFor='accept-return' className='text-sm leading-snug cursor-pointer'>
            Confirmo que he revisado la información del contrato/suscripción y acepto el acta de
            retiro.
          </Label>
        </div>
        <Button onClick={handleAccept} disabled={loading || !accepted} className='w-full'>
          {loading && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
          Aceptar acta de retiro
        </Button>
      </CardContent>
    </Card>
  )
}
