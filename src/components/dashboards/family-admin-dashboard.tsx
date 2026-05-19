'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  Package,
  FileText,
  AlertCircle,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { NewsFeed } from '@/components/news'
import { useUserModules } from '@/hooks/use-user-modules'

interface FamilyAdminStats {
  totalEquipment: number
  availableEquipment: number
  pendingRequests: number
  activeContracts: number
  inventoryValue: number
  forSale: number
}

export function FamilyAdminDashboard({ userId }: { userId: string }) {
  const { news: hasNews } = useUserModules()
  const [stats, setStats] = useState<FamilyAdminStats>({
    totalEquipment: 0,
    availableEquipment: 0,
    pendingRequests: 0,
    activeContracts: 0,
    inventoryValue: 0,
    forSale: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [userId])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      // Cargar estadísticas de equipos
      const equipmentRes = await fetch('/api/inventory/equipment/count')
      if (equipmentRes.ok) {
        const equipmentData = await equipmentRes.json()
        setStats(prev => ({
          ...prev,
          totalEquipment: equipmentData.total || 0,
          availableEquipment: equipmentData.available || 0,
        }))
      }

      // Cargar solicitudes pendientes
      const requestsRes = await fetch(
        '/api/inventory/asset-requests?status=PENDING&status=UNDER_REVIEW'
      )
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setStats(prev => ({ ...prev, pendingRequests: requestsData.total || 0 }))
      }

      // Cargar contratos activos
      const contractsRes = await fetch('/api/inventory/contracts/stats')
      if (contractsRes.ok) {
        const contractsData = await contractsRes.json()
        setStats(prev => ({
          ...prev,
          activeContracts: contractsData.active || 0,
        }))
      }

      // Cargar equipos en venta
      const salesRes = await fetch('/api/inventory/sales/stats')
      if (salesRes.ok) {
        const salesData = await salesRes.json()
        setStats(prev => ({
          ...prev,
          forSale: salesData.totalForSale || 0,
          inventoryValue: salesData.totalValue || 0,
        }))
      }
    } catch (error) {
      console.error('Error cargando dashboard:', error)
      toast.error('Error al cargar datos del dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold'>Dashboard de Familia</h1>
        <p className='text-muted-foreground'>
          Gestiona el inventario y solicitudes de tus familias asignadas
        </p>
      </div>

      {/* Noticias y Comunicados */}
      {hasNews && <NewsFeed />}

      {/* Estadísticas Principales */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Total de Equipos</CardTitle>
            <Package className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.totalEquipment}</div>
            <p className='text-xs text-muted-foreground'>En todas tus familias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Disponibles</CardTitle>
            <CheckCircle className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.availableEquipment}</div>
            <p className='text-xs text-muted-foreground'>Listos para asignar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Solicitudes Pendientes</CardTitle>
            <Clock className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.pendingRequests}</div>
            <p className='text-xs text-muted-foreground'>Requieren revisión</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Contratos Activos</CardTitle>
            <FileText className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.activeContracts}</div>
            <p className='text-xs text-muted-foreground'>Contratos vigentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>En Venta</CardTitle>
            <TrendingUp className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{stats.forSale}</div>
            <p className='text-xs text-muted-foreground'>Equipos en vitrina</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>Valor en Venta</CardTitle>
            <DollarSign className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>${stats.inventoryValue.toLocaleString()}</div>
            <p className='text-xs text-muted-foreground'>Valor total en vitrina</p>
          </CardContent>
        </Card>
      </div>

      {/* Acciones Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
          <CardDescription>Accede rápidamente a las funciones de gestión</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 md:grid-cols-4'>
          <Link href='/admin/inventory/asset-requests'>
            <Button className='w-full' variant='outline'>
              <FileText className='mr-2 h-4 w-4' />
              Revisar Solicitudes
            </Button>
          </Link>
          <Link href='/admin/inventory/sales-manager'>
            <Button className='w-full' variant='outline'>
              <TrendingUp className='mr-2 h-4 w-4' />
              Gestor de Ventas
            </Button>
          </Link>
          <Link href='/inventory/equipment'>
            <Button className='w-full' variant='outline'>
              <Package className='mr-2 h-4 w-4' />
              Ver Equipos
            </Button>
          </Link>
          <Link href='/inventory/contracts'>
            <Button className='w-full' variant='outline'>
              <FileText className='mr-2 h-4 w-4' />
              Ver Contratos
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Alertas y Notificaciones */}
      <div className='grid gap-4 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-orange-500' />
              Alertas Importantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              {stats.pendingRequests > 0 && (
                <div className='flex items-center justify-between p-2 rounded-lg bg-orange-50 dark:bg-orange-950'>
                  <p className='text-sm'>{stats.pendingRequests} solicitud(es) pendiente(s)</p>
                  <Link href='/admin/inventory/asset-requests?status=pending'>
                    <Button variant='ghost' size='sm'>
                      Ver
                    </Button>
                  </Link>
                </div>
              )}
              {stats.pendingRequests === 0 && (
                <p className='text-sm text-muted-foreground'>No hay alertas pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen de Actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Tasa de Disponibilidad</span>
                <span className='text-sm font-medium'>
                  {stats.totalEquipment > 0
                    ? ((stats.availableEquipment / stats.totalEquipment) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-muted-foreground'>Equipos en Venta</span>
                <span className='text-sm font-medium'>
                  {stats.totalEquipment > 0
                    ? ((stats.forSale / stats.totalEquipment) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
