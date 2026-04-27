'use client'

/**
 * InventoryStatsSection
 * Sección de métricas de inventario para el dashboard.
 * Se monta solo si el usuario tiene acceso al módulo de inventario.
 * Autocontenida: hace su propio fetch, no depende del stats global.
 */

import { Package, Wrench, ShieldAlert, FileText, AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useInventoryStats } from '@/hooks/dashboard/use-inventory-stats'

interface InventoryStatsSectionProps {
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}

export function InventoryStatsSection({ role }: InventoryStatsSectionProps) {
  const { stats, isLoading } = useInventoryStats()

  // Loading skeleton
  if (isLoading) {
    return (
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8'>
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className='h-28 rounded-xl' />
        ))}
      </div>
    )
  }

  // Sin acceso al módulo → no renderizar nada
  if (!stats) return null

  // Vista simplificada para cliente sin gestión
  if (role === 'CLIENT' && stats.assignedEquipment !== undefined) {
    if (stats.assignedEquipment === 0) return null
    return (
      <div className='mb-8'>
        {/* Header consistente */}
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <Package className='h-5 w-5 text-muted-foreground' />
            <h3 className='text-sm font-semibold text-foreground'>Mis Equipos</h3>
            {(stats.pendingMaintenance ?? 0) > 0 && (
              <Badge variant='outline' className='text-xs h-5 px-1.5 border-amber-400 text-amber-700'>
                {stats.pendingMaintenance} mantenimientos
              </Badge>
            )}
          </div>
          <Button variant='ghost' size='sm' asChild>
            <Link href='/inventory?personalOnly=true' className='gap-1 text-xs'>
              Ver equipos <ArrowRight className='h-3 w-3' />
            </Link>
          </Button>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <SymmetricStatsCard
            title='Equipos Asignados'
            value={stats.assignedEquipment}
            icon={Package}
            color='blue'
            role='CLIENT'
            badge={{ text: 'A tu cargo', variant: 'secondary' }}
          />
          <SymmetricStatsCard
            title='Mantenimientos Pendientes'
            value={stats.pendingMaintenance ?? 0}
            icon={Wrench}
            color='orange'
            role='CLIENT'
            status={(stats.pendingMaintenance ?? 0) > 0 ? 'warning' : 'normal'}
            badge={{ text: 'Tus equipos', variant: 'default' }}
          />
        </div>
      </div>
    )
  }

  // Vista completa para ADMIN y TECHNICIAN gestor
  const hasAlerts =
    stats.lowStockConsumables > 0 ||
    stats.outOfStockConsumables > 0 ||
    stats.expiredLicenses > 0 ||
    stats.pendingDeliveryActs > 0 ||
    stats.pendingDecommissions > 0

  return (
    <div className='mb-8'>
      {/* Header de sección */}
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-2'>
          <Package className='h-5 w-5 text-muted-foreground' />
          <h3 className='text-sm font-semibold text-foreground'>Módulo de Inventario</h3>
          {hasAlerts && (
            <Badge variant='destructive' className='text-xs h-5 px-1.5 gap-1'>
              <AlertTriangle className='h-3 w-3' />
              Requiere atención
            </Badge>
          )}
        </div>
        <Button variant='ghost' size='sm' asChild>
          <Link href='/inventory' className='gap-1 text-xs'>
            Ver inventario <ArrowRight className='h-3 w-3' />
          </Link>
        </Button>
      </div>

      {/* Stats cards de equipos */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4'>
        <SymmetricStatsCard
          title='Total Activos'
          value={stats.totalAssets}
          icon={Package}
          color='blue'
          badge={{ text: `${stats.availableAssets} disponibles`, variant: 'secondary' }}
        />
        <SymmetricStatsCard
          title='Asignados'
          value={stats.assignedAssets}
          icon={Package}
          color='green'
          badge={{
            text: `${stats.maintenanceAssets} en mantenimiento`,
            variant: stats.maintenanceAssets > 0 ? 'outline' : 'secondary',
          }}
          status={stats.maintenanceAssets > 0 ? 'warning' : 'normal'}
        />
        <SymmetricStatsCard
          title='Consumibles'
          value={stats.totalConsumables}
          icon={Wrench}
          color='orange'
          badge={{
            text: stats.outOfStockConsumables > 0
              ? `${stats.outOfStockConsumables} sin stock`
              : stats.lowStockConsumables > 0
                ? `${stats.lowStockConsumables} bajo stock`
                : 'Stock OK',
            variant: stats.outOfStockConsumables > 0
              ? 'destructive'
              : stats.lowStockConsumables > 0
                ? 'outline'
                : 'secondary',
          }}
          status={stats.outOfStockConsumables > 0 ? 'error' : stats.lowStockConsumables > 0 ? 'warning' : 'normal'}
        />
        <SymmetricStatsCard
          title='Licencias'
          value={stats.totalLicenses}
          icon={ShieldAlert}
          color='purple'
          badge={{
            text: stats.expiredLicenses > 0
              ? `${stats.expiredLicenses} vencidas`
              : stats.expiringLicenses > 0
                ? `${stats.expiringLicenses} por vencer`
                : 'Al día',
            variant: stats.expiredLicenses > 0
              ? 'destructive'
              : stats.expiringLicenses > 0
                ? 'outline'
                : 'secondary',
          }}
          status={stats.expiredLicenses > 0 ? 'error' : stats.expiringLicenses > 0 ? 'warning' : 'normal'}
        />
      </div>

      {/* Actas y solicitudes pendientes — solo si hay algo */}
      {(stats.pendingDeliveryActs > 0 || stats.pendingReturnActs > 0 || stats.pendingDecommissions > 0) && (
        <Card className='border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800'>
          <CardHeader className='pb-2 pt-3 px-4'>
            <CardTitle className='text-sm flex items-center gap-2 text-amber-800 dark:text-amber-200'>
              <FileText className='h-4 w-4' />
              Actas y solicitudes pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className='px-4 pb-3'>
            <div className='flex flex-wrap gap-3'>
              {stats.pendingDeliveryActs > 0 && (
                <Link href='/inventory/acts?tab=delivery&status=PENDING'>
                  <Badge variant='outline' className='gap-1 cursor-pointer hover:bg-amber-100 border-amber-300 text-amber-800'>
                    {stats.pendingDeliveryActs} actas de entrega
                  </Badge>
                </Link>
              )}
              {stats.pendingReturnActs > 0 && (
                <Link href='/inventory/acts?tab=return&status=PENDING'>
                  <Badge variant='outline' className='gap-1 cursor-pointer hover:bg-amber-100 border-amber-300 text-amber-800'>
                    {stats.pendingReturnActs} actas de devolución
                  </Badge>
                </Link>
              )}
              {stats.pendingDecommissions > 0 && (
                <Link href='/inventory/decommission'>
                  <Badge variant='outline' className='gap-1 cursor-pointer hover:bg-amber-100 border-amber-300 text-amber-800'>
                    {stats.pendingDecommissions} solicitudes de baja
                  </Badge>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
