import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, TrendingDown, Minus, Star, Copy } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { EQUIPMENT_CONDITION_LABELS } from '@/lib/utils/equipment-display'

interface BatchComparison {
  batchId: string
  batchCode: string
  quantity: number
  supplier: string
  unitPrice: number
  purchaseDate: Date
  failureRate: number
  condition: string
  accessories: any[]
  available: number
  assigned: number
  maintenance: number
  utilizationRate: number
}

interface ModelBatchComparisonProps {
  batches: BatchComparison[]
}

export function ModelBatchComparison({ batches }: ModelBatchComparisonProps) {
  if (batches.length === 0) {
    return <div className='text-center py-8 text-muted-foreground'>No hay lotes para comparar</div>
  }

  if (batches.length === 1) {
    const b = batches[0]
    return (
      <div className='text-center py-8 text-muted-foreground space-y-3'>
        <p>Solo hay un lote registrado para este modelo.</p>
        <Button variant='outline' size='sm' asChild>
          <Link href={`/inventory/batches/${b.batchId}`}>Ver lote {b.batchCode}</Link>
        </Button>
      </div>
    )
  }

  const prices = batches.map(b => b.unitPrice).filter(p => p > 0)
  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const avgPrice = prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : 0

  const failureRates = batches.map(b => b.failureRate)
  const minFailure = failureRates.length ? Math.min(...failureRates) : 0

  const bestBatch = batches.reduce((best, b) => {
    const score = b.unitPrice / (maxPrice || 1) + b.failureRate / 100 + b.utilizationRate / 200
    const bestScore =
      best.unitPrice / (maxPrice || 1) + best.failureRate / 100 + best.utilizationRate / 200
    return score < bestScore ? b : best
  }, batches[0])

  const getPriceIcon = (price: number) => {
    if (price === minPrice && prices.length > 1)
      return <TrendingDown className='w-3 h-3 text-green-600' />
    if (price === maxPrice && prices.length > 1)
      return <TrendingUp className='w-3 h-3 text-red-600' />
    return <Minus className='w-3 h-3 text-gray-400' />
  }

  const getPriceVariation = (price: number) => {
    if (avgPrice === 0) return null
    const pct = ((price - avgPrice) / avgPrice) * 100
    if (Math.abs(pct) < 1) return null
    return (
      <span className={`text-xs ${pct > 0 ? 'text-red-500' : 'text-green-500'}`}>
        {pct > 0 ? '+' : ''}
        {pct.toFixed(1)}%
      </span>
    )
  }

  const conditionLabel = (c: string) => EQUIPMENT_CONDITION_LABELS[c] ?? c

  return (
    <div className='space-y-4'>
      <Card className='border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800'>
        <CardContent className='pt-4'>
          <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <Star className='w-4 h-4 text-green-600 shrink-0' />
              <p className='text-sm text-green-800 dark:text-green-200'>
                <strong>Mejor relación costo/rendimiento:</strong> {bestBatch.batchCode} — menor
                precio, menor tasa de fallas y mejor disponibilidad relativa.
              </p>
            </div>
            {(bestBatch.utilizationRate >= 80 || bestBatch.available === 0) && (
              <Button variant='outline' size='sm' asChild className='shrink-0 gap-1.5 bg-white/80'>
                <Link href={`/inventory/equipment/bulk/new?cloneFrom=${bestBatch.batchId}`}>
                  <Copy className='h-3.5 w-3.5' />
                  Recomprar similar
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cant.</TableHead>
              <TableHead>Disponibles</TableHead>
              <TableHead>Utilización</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Precio Unit.</TableHead>
              <TableHead>Condición</TableHead>
              <TableHead>Tasa Fallas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map(batch => (
              <TableRow
                key={batch.batchId}
                className={
                  batch.batchId === bestBatch.batchId ? 'bg-green-50/60 dark:bg-green-950/10' : ''
                }
              >
                <TableCell>
                  <div className='flex items-center gap-1'>
                    {batch.batchId === bestBatch.batchId && (
                      <Star className='w-3 h-3 text-green-600 shrink-0' />
                    )}
                    <Link
                      href={`/inventory/batches/${batch.batchId}`}
                      className='font-mono text-sm text-primary hover:underline'
                    >
                      {batch.batchCode}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className='text-sm whitespace-nowrap'>
                  {format(new Date(batch.purchaseDate), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell className='font-medium'>{batch.quantity}</TableCell>
                <TableCell>
                  <span className={batch.available === 0 ? 'text-red-600 font-medium' : ''}>
                    {batch.available}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`text-sm font-medium ${
                      batch.utilizationRate >= 90
                        ? 'text-red-600'
                        : batch.utilizationRate >= 70
                          ? 'text-amber-600'
                          : ''
                    }`}
                  >
                    {batch.utilizationRate.toFixed(0)}%
                  </span>
                </TableCell>
                <TableCell className='text-sm max-w-[120px] truncate' title={batch.supplier}>
                  {batch.supplier}
                </TableCell>
                <TableCell>
                  <div className='flex items-center gap-1'>
                    {getPriceIcon(batch.unitPrice)}
                    <span className='font-medium'>${batch.unitPrice.toFixed(2)}</span>
                    {getPriceVariation(batch.unitPrice)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='outline' className='text-xs'>
                    {conditionLabel(batch.condition)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={`font-medium text-sm ${
                      batch.failureRate === minFailure && failureRates.length > 1
                        ? 'text-green-600'
                        : batch.failureRate > 10
                          ? 'text-red-600'
                          : ''
                    }`}
                  >
                    {batch.failureRate.toFixed(1)}%
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className='text-xs text-muted-foreground'>
        Precio promedio: ${avgPrice.toFixed(2)}
        {prices.length > 1 && ` · Variación: $${(maxPrice - minPrice).toFixed(2)}`}
        {' · '}
        Tasa de fallas = equipos en mantenimiento / total del lote
      </p>
    </div>
  )
}
