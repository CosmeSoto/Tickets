'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowRight,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContractInChain {
  id: string
  name: string
  status: string
  startDate: Date | null
  endDate: Date | null
  totalValue: number | null
  monthlyCost: number | null
  billingCycle: string
  autoRenew: boolean
  renewalCount: number
  createdAt: Date
  creator: {
    name: string
    email: string
  }
  supplier: {
    name: string
  } | null
  family: {
    name: string
    color: string | null
  } | null
  changes: {
    totalValue?: { from: number; to: number; diff: number }
    monthlyCost?: { from: number; to: number; diff: number }
    billingCycle?: { from: string; to: string }
    autoRenew?: { from: boolean; to: boolean }
  } | null
  isOriginal: boolean
  isCurrent: boolean
  position: number
  totalInChain: number
}

interface ContractHistoryTimelineProps {
  contractId: string
}

export function ContractHistoryTimeline({ contractId }: ContractHistoryTimelineProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [chain, setChain] = useState<ContractInChain[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadHistory()
  }, [contractId])

  const loadHistory = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/inventory/contracts/${contractId}/history`)
      if (!response.ok) {
        throw new Error('Error al cargar historial')
      }

      const data = await response.json()
      setChain(data.chain)
    } catch (err) {
      console.error('Error cargando historial:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return 'N/A'
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(value)
  }

  const getBillingCycleLabel = (cycle: string) => {
    const labels: Record<string, string> = {
      MONTHLY: 'Mensual',
      QUARTERLY: 'Trimestral',
      BIANNUAL: 'Semestral',
      ANNUAL: 'Anual',
      ONE_TIME: 'Único',
    }
    return labels[cycle] || cycle
  }

  const getStatusBadge = (status: string, isCurrent: boolean) => {
    if (isCurrent) {
      return <Badge variant='default'>Actual</Badge>
    }

    const variants: Record<string, any> = {
      ACTIVE: 'default',
      RENEWED: 'secondary',
      EXPIRED: 'destructive',
      DRAFT: 'outline',
    }

    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <RefreshCw className='h-5 w-5' />
            Historial de Renovaciones
          </CardTitle>
          <CardDescription>Cargando historial...</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className='h-32 w-full' />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <RefreshCw className='h-5 w-5' />
            Historial de Renovaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-destructive'>{error}</p>
          <Button onClick={loadHistory} variant='outline' size='sm' className='mt-4'>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (chain.length <= 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <RefreshCw className='h-5 w-5' />
            Historial de Renovaciones
          </CardTitle>
          <CardDescription>
            Este contrato no tiene renovaciones previas ni posteriores
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <RefreshCw className='h-5 w-5' />
          Historial de Renovaciones
        </CardTitle>
        <CardDescription>
          Cadena completa de {chain.length} contrato(s) - {chain.length - 1} renovación(es)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-6'>
          {chain.map((contract, index) => (
            <div key={contract.id} className='relative'>
              {/* Línea conectora */}
              {index < chain.length - 1 && (
                <div className='absolute left-6 top-full h-6 w-0.5 bg-border' />
              )}

              <div
                className={cn(
                  'flex gap-4 p-4 rounded-lg border transition-colors',
                  contract.isCurrent && 'bg-primary/5 border-primary',
                  contract.isOriginal && 'bg-muted'
                )}
              >
                {/* Indicador de posición */}
                <div className='flex flex-col items-center gap-2'>
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold',
                      contract.isCurrent && 'border-primary bg-primary text-primary-foreground',
                      contract.isOriginal && 'border-muted-foreground bg-muted',
                      !contract.isCurrent && !contract.isOriginal && 'border-border bg-background'
                    )}
                  >
                    {contract.position}
                  </div>
                  {contract.isOriginal && (
                    <Badge variant='outline' className='text-xs'>
                      Original
                    </Badge>
                  )}
                </div>

                {/* Contenido del contrato */}
                <div className='flex-1 space-y-3'>
                  {/* Encabezado */}
                  <div className='flex items-start justify-between gap-4'>
                    <div>
                      <h4 className='font-semibold'>{contract.name}</h4>
                      <p className='text-sm text-muted-foreground'>
                        Creado por {contract.creator.name} el {formatDate(contract.createdAt)}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      {getStatusBadge(contract.status, contract.isCurrent)}
                      {!contract.isCurrent && (
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => router.push(`/inventory/contracts/${contract.id}`)}
                        >
                          <ExternalLink className='h-4 w-4' />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Información del período */}
                  <div className='flex items-center gap-4 text-sm'>
                    <div className='flex items-center gap-1'>
                      <Calendar className='h-4 w-4 text-muted-foreground' />
                      <span>
                        {formatDate(contract.startDate)} - {formatDate(contract.endDate)}
                      </span>
                    </div>
                    {contract.supplier && (
                      <span className='text-muted-foreground'>• {contract.supplier.name}</span>
                    )}
                  </div>

                  {/* Términos económicos */}
                  <div className='flex items-center gap-4 text-sm'>
                    {contract.totalValue && (
                      <div className='flex items-center gap-1'>
                        <DollarSign className='h-4 w-4 text-muted-foreground' />
                        <span>Total: {formatCurrency(contract.totalValue)}</span>
                      </div>
                    )}
                    {contract.monthlyCost && (
                      <span className='text-muted-foreground'>
                        • Mensual: {formatCurrency(contract.monthlyCost)}
                      </span>
                    )}
                    <span className='text-muted-foreground'>
                      • {getBillingCycleLabel(contract.billingCycle)}
                    </span>
                  </div>

                  {/* Cambios respecto al anterior */}
                  {contract.changes && Object.keys(contract.changes).length > 0 && (
                    <div className='mt-3 space-y-2 rounded-md bg-muted/50 p-3'>
                      <p className='text-xs font-medium text-muted-foreground'>
                        Cambios respecto a la versión anterior:
                      </p>
                      <div className='space-y-1'>
                        {contract.changes.totalValue && (
                          <div className='flex items-center gap-2 text-sm'>
                            {contract.changes.totalValue.diff > 0 ? (
                              <TrendingUp className='h-4 w-4 text-green-600' />
                            ) : contract.changes.totalValue.diff < 0 ? (
                              <TrendingDown className='h-4 w-4 text-red-600' />
                            ) : (
                              <Minus className='h-4 w-4 text-muted-foreground' />
                            )}
                            <span>
                              Valor total: {formatCurrency(contract.changes.totalValue.from)}{' '}
                              <ArrowRight className='inline h-3 w-3' />{' '}
                              {formatCurrency(contract.changes.totalValue.to)}
                              {contract.changes.totalValue.diff !== 0 && (
                                <span
                                  className={cn(
                                    'ml-2 text-xs',
                                    contract.changes.totalValue.diff > 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  )}
                                >
                                  ({contract.changes.totalValue.diff > 0 ? '+' : ''}
                                  {formatCurrency(contract.changes.totalValue.diff)})
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {contract.changes.monthlyCost && (
                          <div className='flex items-center gap-2 text-sm'>
                            {contract.changes.monthlyCost.diff > 0 ? (
                              <TrendingUp className='h-4 w-4 text-green-600' />
                            ) : contract.changes.monthlyCost.diff < 0 ? (
                              <TrendingDown className='h-4 w-4 text-red-600' />
                            ) : (
                              <Minus className='h-4 w-4 text-muted-foreground' />
                            )}
                            <span>
                              Costo mensual: {formatCurrency(contract.changes.monthlyCost.from)}{' '}
                              <ArrowRight className='inline h-3 w-3' />{' '}
                              {formatCurrency(contract.changes.monthlyCost.to)}
                              {contract.changes.monthlyCost.diff !== 0 && (
                                <span
                                  className={cn(
                                    'ml-2 text-xs',
                                    contract.changes.monthlyCost.diff > 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  )}
                                >
                                  ({contract.changes.monthlyCost.diff > 0 ? '+' : ''}
                                  {formatCurrency(contract.changes.monthlyCost.diff)})
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {contract.changes.billingCycle && (
                          <div className='flex items-center gap-2 text-sm'>
                            <ArrowRight className='h-4 w-4 text-muted-foreground' />
                            <span>
                              Ciclo: {getBillingCycleLabel(contract.changes.billingCycle.from)}{' '}
                              <ArrowRight className='inline h-3 w-3' />{' '}
                              {getBillingCycleLabel(contract.changes.billingCycle.to)}
                            </span>
                          </div>
                        )}

                        {contract.changes.autoRenew && (
                          <div className='flex items-center gap-2 text-sm'>
                            <ArrowRight className='h-4 w-4 text-muted-foreground' />
                            <span>
                              Renovación automática: {contract.changes.autoRenew.from ? 'Sí' : 'No'}{' '}
                              <ArrowRight className='inline h-3 w-3' />{' '}
                              {contract.changes.autoRenew.to ? 'Sí' : 'No'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
