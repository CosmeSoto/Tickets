'use client'

import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DepreciationInfo {
  annualDepreciation: number
  accumulatedDepreciation: number
  bookValue: number
  yearsElapsed: number
}

interface DepreciationCardProps {
  purchasePrice?: number | null
  purchaseDate?: string | Date | null
  usefulLifeYears?: number | null
  residualValue?: number | null
  depreciation?: DepreciationInfo | null
  depreciationMethod?: string | null
  totalUnits?: number | null
  usedUnits?: number | null
}

const METHOD_LABELS: Record<string, string> = {
  LINEAR: 'Línea Recta',
  DECLINING_BALANCE: 'Saldo Decreciente Acelerado',
  UNITS_OF_PRODUCTION: 'Por Uso',
}

function fmt(n: number) {
  return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function DepreciationCard({
  purchasePrice,
  purchaseDate,
  usefulLifeYears,
  residualValue,
  depreciation,
  depreciationMethod,
  totalUnits,
  usedUnits,
}: DepreciationCardProps) {
  if (!usefulLifeYears) return null

  const methodLabel = METHOD_LABELS[depreciationMethod ?? 'LINEAR'] ?? 'Línea Recta'
  const isUsageBased = depreciationMethod === 'UNITS_OF_PRODUCTION'
  const usagePct =
    totalUnits && usedUnits ? Math.min(100, Math.round((usedUnits / totalUnits) * 100)) : null

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <TrendingDown className='h-4 w-4 text-amber-600 dark:text-amber-400' />
          Depreciación — {methodLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3'>
          {purchasePrice != null && (
            <div>
              <p className='text-xs font-medium uppercase text-muted-foreground'>
                Costo adquisición
              </p>
              <p className='font-semibold'>${fmt(purchasePrice)}</p>
            </div>
          )}
          {purchaseDate && (
            <div>
              <p className='text-xs font-medium uppercase text-muted-foreground'>Fecha de compra</p>
              <p className='font-semibold'>
                {new Date(purchaseDate).toLocaleDateString('es-EC', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          <div>
            <p className='text-xs font-medium uppercase text-muted-foreground'>Vida útil</p>
            <p className='font-semibold'>
              {usefulLifeYears} año{usefulLifeYears !== 1 ? 's' : ''}
            </p>
          </div>
          {residualValue != null && (
            <div>
              <p className='text-xs font-medium uppercase text-muted-foreground'>Valor residual</p>
              <p className='font-semibold'>${fmt(residualValue)}</p>
            </div>
          )}

          {/* Campos específicos de "Por Uso" */}
          {isUsageBased && totalUnits != null && (
            <div>
              <p className='text-xs font-medium uppercase text-muted-foreground'>Capacidad total</p>
              <p className='font-semibold'>{totalUnits.toLocaleString('es-EC')} unidades</p>
            </div>
          )}
          {isUsageBased && usedUnits != null && (
            <div>
              <p className='text-xs font-medium uppercase text-muted-foreground'>Uso acumulado</p>
              <p className='font-semibold'>
                {usedUnits.toLocaleString('es-EC')} unidades
                {usagePct != null && (
                  <span className='ml-1 text-xs text-muted-foreground'>({usagePct}%)</span>
                )}
              </p>
            </div>
          )}
          {isUsageBased && usagePct != null && (
            <div className='col-span-2 sm:col-span-3'>
              <div className='h-2 rounded-full bg-muted overflow-hidden'>
                <div
                  className='h-full rounded-full bg-amber-500 transition-all'
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          )}

          {depreciation && (
            <>
              <div>
                <p className='text-xs font-medium uppercase text-muted-foreground'>
                  {isUsageBased ? 'Depreciación estimada/año' : 'Depreciación anual'}
                </p>
                <p className='font-semibold text-amber-600 dark:text-amber-400'>
                  ${fmt(depreciation.annualDepreciation)}
                </p>
              </div>
              <div>
                <p className='text-xs font-medium uppercase text-muted-foreground'>
                  Depreciación acumulada
                </p>
                <p className='font-semibold text-amber-600 dark:text-amber-400'>
                  ${fmt(depreciation.accumulatedDepreciation)}
                </p>
              </div>
              <div className='col-span-2 sm:col-span-1'>
                <p className='text-xs font-medium uppercase text-muted-foreground'>
                  Valor libro actual
                </p>
                <p className='text-lg font-bold text-primary'>${fmt(depreciation.bookValue)}</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
