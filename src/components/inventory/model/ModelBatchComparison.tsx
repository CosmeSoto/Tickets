import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus, Star } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

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
  customValues: any
}

interface ModelBatchComparisonProps {
  batches: BatchComparison[]
}

export function ModelBatchComparison({ batches }: ModelBatchComparisonProps) {
  if (batches.length === 0) {
    return <div className='text-center py-8 text-muted-foreground'>No hay lotes para comparar</div>
  }

  // Calcular estadísticas para resaltar diferencias
  const prices = batches.map(b => b.unitPrice).filter(p => p > 0)
  const minPrice = Math.min(...prices)
  const maxPrice = Math.max(...prices)
  const avgPrice = prices.reduce((s, p) => s + p, 0) / (prices.length || 1)

  const failureRates = batches.map(b => b.failureRate)
  const minFailure = Math.min(...failureRates)

  // El "mejor" lote: menor precio + menor tasa de fallas
  const bestBatch = batches.reduce((best, b) => {
    const score = b.unitPrice / (maxPrice || 1) + b.failureRate / 100
    const bestScore = best.unitPrice / (maxPrice || 1) + best.failureRate / 100
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

  return (
    <div className='space-y-4'>
      {/* Recomendación */}
      {batches.length > 1 && (
        <Card className='border-green-200 bg-green-50'>
          <CardContent className='pt-4'>
            <div className='flex items-center gap-2'>
              <Star className='w-4 h-4 text-green-600' />
              <p className='text-sm text-green-700'>
                <strong>Mejor lote:</strong> {bestBatch.batchCode} — menor precio y menor tasa de
                fallas
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabla comparativa */}
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lote</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Precio Unit.</TableHead>
              <TableHead>Condición</TableHead>
              <TableHead>Tasa Fallas</TableHead>
              <TableHead>Accesorios</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map(batch => (
              <TableRow
                key={batch.batchId}
                className={batch.batchId === bestBatch.batchId ? 'bg-green-50' : ''}
              >
                <TableCell>
                  <div className='flex items-center gap-1'>
                    {batch.batchId === bestBatch.batchId && batches.length > 1 && (
                      <Star className='w-3 h-3 text-green-600 shrink-0' />
                    )}
                    <Link
                      href={`/inventory/batches/${batch.batchId}`}
                      className='font-mono text-sm text-blue-600 hover:underline'
                    >
                      {batch.batchCode}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className='text-sm'>
                  {format(new Date(batch.purchaseDate), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell className='font-medium'>{batch.quantity}</TableCell>
                <TableCell className='text-sm'>{batch.supplier}</TableCell>
                <TableCell>
                  <div className='flex items-center gap-1'>
                    {getPriceIcon(batch.unitPrice)}
                    <span className='font-medium'>${batch.unitPrice.toFixed(2)}</span>
                    {getPriceVariation(batch.unitPrice)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant='outline' className='text-xs'>
                    {batch.condition || '—'}
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
                <TableCell className='text-sm text-muted-foreground'>
                  {batch.accessories?.length > 0
                    ? batch.accessories
                        .slice(0, 2)
                        .map((a: any) => a.name || a)
                        .join(', ')
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {batches.length > 1 && (
        <p className='text-xs text-muted-foreground'>
          Precio promedio: ${avgPrice.toFixed(2)} · Variación: ${(maxPrice - minPrice).toFixed(2)}
        </p>
      )}
    </div>
  )
}
