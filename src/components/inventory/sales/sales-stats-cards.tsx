'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Package, ShoppingCart, TrendingUp } from 'lucide-react'

interface SalesStatsCardsProps {
  stats: {
    totalForSale: number
    totalAvailable: number
    totalValue: number
  }
}

export function SalesStatsCards({ stats }: SalesStatsCardsProps) {
  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>En Venta</CardTitle>
          <ShoppingCart className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats.totalForSale}</div>
          <p className='text-xs text-muted-foreground'>Equipos activos para venta</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Disponibles</CardTitle>
          <Package className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>{stats.totalAvailable}</div>
          <p className='text-xs text-muted-foreground'>Equipos disponibles para activar</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Valor Total</CardTitle>
          <DollarSign className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>${stats.totalValue.toLocaleString()}</div>
          <p className='text-xs text-muted-foreground'>Valor total en venta</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
          <CardTitle className='text-sm font-medium'>Tasa de Venta</CardTitle>
          <TrendingUp className='h-4 w-4 text-muted-foreground' />
        </CardHeader>
        <CardContent>
          <div className='text-2xl font-bold'>
            {stats.totalForSale > 0
              ? ((stats.totalForSale / (stats.totalForSale + stats.totalAvailable)) * 100).toFixed(
                  1
                )
              : 0}
            %
          </div>
          <p className='text-xs text-muted-foreground'>Equipos en venta vs disponibles</p>
        </CardContent>
      </Card>
    </div>
  )
}
