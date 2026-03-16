'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'

interface ActAcceptanceFormProps {
  actId: string
  token: string
  onSuccess?: () => void
}

const TERMS_AND_CONDITIONS = `
TÉRMINOS Y CONDICIONES DE RECEPCIÓN DE EQUIPO

Al aceptar esta acta de entrega, usted declara que:

1. Ha recibido el equipo descrito en esta acta en las condiciones especificadas.

2. Ha verificado que todos los accesorios listados están incluidos y en buen estado.

3. Se compromete a:
   - Usar el equipo únicamente para fines laborales autorizados
   - Mantener el equipo en buen estado y condiciones de funcionamiento
   - Reportar inmediatamente cualquier daño, pérdida o mal funcionamiento
   - No realizar modificaciones no autorizadas al equipo
   - Devolver el equipo cuando sea requerido por la empresa

4. Entiende que es responsable por:
   - El cuidado y custodia del equipo asignado
   - Cualquier daño causado por uso inadecuado o negligencia
   - La devolución del equipo en las mismas condiciones (considerando el desgaste normal)

5. Acepta que la empresa puede:
   - Solicitar la devolución del equipo en cualquier momento
   - Realizar inspecciones periódicas del estado del equipo
   - Aplicar las políticas de uso de equipos de la empresa

6. Esta aceptación constituye un acuerdo legal entre usted y la empresa, y será firmada digitalmente con su dirección IP y marca de tiempo para garantizar su autenticidad.
`.trim()

export function ActAcceptanceForm({ actId, token, onSuccess }: ActAcceptanceFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  const handleAccept = async () => {
    if (!acceptedTerms) {
      toast({
        title: 'Error',
        description: 'Debes aceptar los términos y condiciones',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/inventory/acts/${actId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          acceptedTerms: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al aceptar acta')
      }

      const result = await response.json()

      toast({
        title: 'Acta Aceptada',
        description: 'Has aceptado el acta de entrega exitosamente',
      })

      onSuccess?.()
      
      // Recargar la página para mostrar el estado actualizado
      router.refresh()
    } catch (error) {
      console.error('Error aceptando acta:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo aceptar el acta',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      toast({
        title: 'Error',
        description: 'Debes proporcionar una razón de al menos 10 caracteres',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      const response = await fetch(`/api/inventory/acts/${actId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          reason: rejectionReason.trim(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al rechazar acta')
      }

      const result = await response.json()

      toast({
        title: 'Acta Rechazada',
        description: 'Has rechazado el acta de entrega',
      })

      onSuccess?.()
      
      // Recargar la página para mostrar el estado actualizado
      router.refresh()
    } catch (error) {
      console.error('Error rechazando acta:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo rechazar el acta',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (showRejectForm) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Rechazar Acta de Entrega
          </CardTitle>
          <CardDescription>
            Por favor, proporciona una razón detallada para el rechazo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rejectionReason">
              Razón del Rechazo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explica por qué rechazas esta acta de entrega (mínimo 10 caracteres)..."
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              {rejectionReason.length} / 10 caracteres mínimo
            </p>
          </div>

          <Alert>
            <AlertTitle>Importante</AlertTitle>
            <AlertDescription>
              Al rechazar esta acta, la asignación del equipo será cancelada y el equipo quedará disponible nuevamente.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRejectForm(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleReject}
              disabled={loading || rejectionReason.trim().length < 10}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Rechazo
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          Aceptación de Acta de Entrega
        </CardTitle>
        <CardDescription>
          Lee cuidadosamente los términos y condiciones antes de aceptar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Términos y Condiciones */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Términos y Condiciones</Label>
          <div className="rounded-md border p-4 max-h-96 overflow-y-auto bg-muted/50">
            <pre className="text-sm whitespace-pre-wrap font-sans">{TERMS_AND_CONDITIONS}</pre>
          </div>
        </div>

        {/* Checkbox de Aceptación */}
        <div className="flex items-start space-x-3 space-y-0">
          <Checkbox
            id="acceptTerms"
            checked={acceptedTerms}
            onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
            disabled={loading}
          />
          <div className="space-y-1 leading-none">
            <Label
              htmlFor="acceptTerms"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              He leído y acepto los términos y condiciones
            </Label>
            <p className="text-xs text-muted-foreground">
              Al marcar esta casilla, confirmas que has recibido el equipo y aceptas las condiciones descritas
            </p>
          </div>
        </div>

        {/* Alerta de Firma Digital */}
        <Alert>
          <AlertTitle>Firma Digital</AlertTitle>
          <AlertDescription>
            Al aceptar, se registrará tu dirección IP, fecha, hora y navegador como firma digital para garantizar la autenticidad de esta aceptación.
          </AlertDescription>
        </Alert>

        {/* Botones */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            onClick={handleAccept}
            disabled={!acceptedTerms || loading}
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aceptar Acta de Entrega
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
            className="flex-1 sm:flex-initial"
          >
            Rechazar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
