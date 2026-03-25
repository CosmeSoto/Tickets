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
}

function fmt(n: number) {
  return n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function DepreciationCard({ purchasePrice, purchaseDate, usefulLifeYears, residualValue, depreciation }: DepreciationCardProps) {
  if (!usefulLifeYears) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-4 w-4 text-orange-500" />
          Depreciación Lineal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          {purchasePrice != null && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Costo adquisición</p>
              <p className="font-semibold">${fmt(purchasePrice)}</p>
            </div>
          )}
          {purchaseDate && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Fecha de compra</p>
              <p className="font-semibold">{new Date(purchaseDate).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Vida útil</p>
            <p className="font-semibold">{usefulLifeYears} año{usefulLifeYears !== 1 ? 's' : ''}</p>
          </div>
          {residualValue != null && (
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Valor residual</p>
              <p className="font-semibold">${fmt(residualValue)}</p>
            </div>
          )}
          {depreciation && (
            <>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Depreciación anual</p>
                <p className="font-semibold text-orange-600">${fmt(depreciation.annualDepreciation)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Depreciación acumulada</p>
                <p className="font-semibold text-orange-600">${fmt(depreciation.accumulatedDepreciation)}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs font-medium uppercase text-muted-foreground">Valor libro actual</p>
                <p className="text-lg font-bold text-primary">${fmt(depreciation.bookValue)}</p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
