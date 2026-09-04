'use client'

/**
 * RentalContractCard — resumen del contrato de arrendamiento/servicio del que
 * depende un equipo o licencia.
 *
 * Un activo en RENTAL/LOAN (equipo) o vinculado a un contrato de negocio
 * (licencia) no tiene factura de compra propia: su costo y calendario de
 * pago viven en el contrato (cuotas en `contract_payments`), no en
 * `equipment_invoices`/`license_invoices`. Sin esta tarjeta, "Información
 * Financiera" y "Facturas / Pagos de adquisición" quedaban vacías sin
 * explicación — dando a entender que faltaba cargar datos, cuando en
 * realidad viven en otro lado.
 */
import Link from 'next/link'
import { FileSignature, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFetch } from '@/hooks/common/use-fetch'
import type { Contract } from '@/types/contracts'
import { CONTRACT_CATEGORY_LABELS, BILLING_CYCLE_LABELS } from '@/types/contracts'

interface RentalContractCardProps {
  contractId: string | null | undefined
  /** "equipo" | "licencia" — para el texto explicativo. */
  assetLabel: string
}

function fmtDate(d?: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('es-EC')
}

export function RentalContractCard({ contractId, assetLabel }: RentalContractCardProps) {
  const { data } = useFetch<Contract>(
    contractId ? `/api/inventory/contracts/${contractId}` : '/api/inventory/contracts',
    {
      enabled: !!contractId,
      transform: d => (d.id ? [d] : []),
      showErrorToast: false,
    }
  )
  const contract = data[0]

  if (!contractId || !contract) return null

  const isRecurring = contract.billingCycle !== 'ONE_TIME'
  const amount = isRecurring ? contract.monthlyCost : contract.totalValue
  const amountLabel = isRecurring
    ? `$${amount?.toFixed(2) ?? '0.00'} / ${BILLING_CYCLE_LABELS[contract.billingCycle]?.toLowerCase() ?? 'ciclo'}`
    : amount != null
      ? `$${amount.toFixed(2)} (pago único)`
      : null

  const start = fmtDate(contract.startDate)
  const end = fmtDate(contract.endDate)

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-base flex items-center gap-2'>
          <FileSignature className='h-4 w-4 text-primary' />
          Contrato vinculado
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3'>
        <p className='text-xs text-muted-foreground'>
          Este {assetLabel} se paga a través de este contrato — no tiene factura de compra propia.
          El costo y el calendario de pago se gestionan en el contrato.
        </p>

        <div className='flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5'>
          <div className='min-w-0 space-y-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              <p className='text-sm font-medium truncate'>{contract.name}</p>
              <Badge variant='outline' className='text-xs h-4'>
                {CONTRACT_CATEGORY_LABELS[contract.category] ?? contract.category}
              </Badge>
            </div>
            {contract.contractNumber && (
              <p className='text-xs text-muted-foreground font-mono'>{contract.contractNumber}</p>
            )}
            <div className='flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground'>
              {amountLabel && <span>{amountLabel}</span>}
              {(start || end) && (
                <span>
                  Vigencia: {start ?? '—'} – {end ?? '—'}
                </span>
              )}
            </div>
          </div>
          <Button variant='outline' size='sm' className='h-7 px-2 text-xs shrink-0' asChild>
            <Link href={`/inventory/contracts?contractId=${contract.id}`}>
              Ver contrato
              <ExternalLink className='h-3.5 w-3.5 ml-1' />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
