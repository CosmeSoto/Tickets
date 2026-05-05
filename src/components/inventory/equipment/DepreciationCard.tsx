'use client'

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

  const isUsageBased = depreciationMethod === 'UNITS_OF_PRODUCTION'
  const usagePct =
    totalUnits && usedUnits ? Math.min(100, Math.round((usedUnits / totalUnits) * 100)) : null

  return (
    <div className='grid grid-cols-2 gap-3 text-sm'>
      {purchasePrice != null && (
        <div>
          <p className='text-xs text-muted-foreground'>Costo adquisición</p>
          <p className='font-semibold'>${fmt(purchasePrice)}</p>
        </div>
      )}
      {purchaseDate && (
        <div>
          <p className='text-xs text-muted-foreground'>Fecha de compra</p>
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
        <p className='text-xs text-muted-foreground'>Vida útil</p>
        <p className='font-semibold'>
          {usefulLifeYears} año{usefulLifeYears !== 1 ? 's' : ''}
        </p>
      </div>
      {residualValue != null && (
        <div>
          <p className='text-xs text-muted-foreground'>Valor residual</p>
          <p className='font-semibold'>${fmt(residualValue)}</p>
        </div>
      )}

      {/* Campos "Por Uso" */}
      {isUsageBased && totalUnits != null && (
        <div>
          <p className='text-xs text-muted-foreground'>Capacidad total</p>
          <p className='font-semibold'>{totalUnits.toLocaleString('es-EC')} u.</p>
        </div>
      )}
      {isUsageBased && usedUnits != null && (
        <div>
          <p className='text-xs text-muted-foreground'>Uso acumulado</p>
          <p className='font-semibold'>
            {usedUnits.toLocaleString('es-EC')} u.
            {usagePct != null && (
              <span className='ml-1 text-xs text-muted-foreground'>({usagePct}%)</span>
            )}
          </p>
        </div>
      )}
      {isUsageBased && usagePct != null && (
        <div className='col-span-2'>
          <div className='h-1.5 rounded-full bg-muted overflow-hidden'>
            <div
              className='h-full rounded-full bg-amber-500 transition-all'
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      )}

      {/* Resultados de depreciación */}
      {depreciation && (
        <>
          <div>
            <p className='text-xs text-muted-foreground'>
              {isUsageBased ? 'Dep. estimada/año' : 'Dep. anual'}
            </p>
            <p className='font-semibold text-amber-600 dark:text-amber-400'>
              ${fmt(depreciation.annualDepreciation)}
            </p>
          </div>
          <div>
            <p className='text-xs text-muted-foreground'>Dep. acumulada</p>
            <p className='font-semibold text-amber-600 dark:text-amber-400'>
              ${fmt(depreciation.accumulatedDepreciation)}
            </p>
          </div>
          <div className='col-span-2 pt-2 border-t border-border'>
            <p className='text-xs text-muted-foreground'>Valor libro actual</p>
            <p className='text-xl font-bold text-primary'>${fmt(depreciation.bookValue)}</p>
          </div>
        </>
      )}
    </div>
  )
}
