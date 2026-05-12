'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSyncDashboardPageMeta } from '@/contexts/dashboard-shell-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { SalesStatsCards } from '@/components/inventory/sales/sales-stats-cards'
import { AvailableEquipmentTable } from '@/components/inventory/sales/available-equipment-table'
import { ForSaleEquipmentTable } from '@/components/inventory/sales/for-sale-equipment-table'
import { ActivateSaleDialog } from '@/components/inventory/sales/activate-sale-dialog'
import { DeactivateSaleDialog } from '@/components/inventory/sales/deactivate-sale-dialog'
import { UpdatePriceDialog } from '@/components/inventory/sales/update-price-dialog'

interface SalesStats {
  totalForSale: number
  totalAvailable: number
  totalValue: number
  byFamily: Array<{
    familyId: string
    familyName: string
    count: number
    value: number
  }>
  byModel: Array<{
    modelId: string
    modelName: string
    count: number
    value: number
  }>
}

interface Equipment {
  id: string
  code: string
  serialNumber: string | null
  status: string
  salePrice: number | null
  saleCurrency: string | null
  saleNotes: string | null
  model: {
    brand: string
    model: string
    sku: string | null
  } | null
  family: {
    name: string
    color: string | null
  } | null
  warehouse: {
    name: string
  } | null
}

export default function SalesManagerPage() {
  const [stats, setStats] = useState<SalesStats | null>(null)
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([])
  const [forSaleEquipment, setForSaleEquipment] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchAvailable, setSearchAvailable] = useState('')
  const [searchForSale, setSearchForSale] = useState('')

  // Dialogs
  const [activateDialog, setActivateDialog] = useState<{
    open: boolean
    equipmentIds: string[]
  }>({ open: false, equipmentIds: [] })

  const [deactivateDialog, setDeactivateDialog] = useState<{
    open: boolean
    equipmentIds: string[]
  }>({ open: false, equipmentIds: [] })

  const [updatePriceDialog, setUpdatePriceDialog] = useState<{
    open: boolean
    equipmentIds: string[]
  }>({ open: false, equipmentIds: [] })

  const loadData = async () => {
    setIsLoading(true)
    try {
      // Cargar estadísticas
      const statsRes = await fetch('/api/inventory/sales/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // Cargar equipos disponibles
      const availableRes = await fetch('/api/inventory/sales/available?pageSize=100')
      if (availableRes.ok) {
        const availableData = await availableRes.json()
        setAvailableEquipment(availableData.equipment)
      }

      // Cargar equipos en venta
      const forSaleRes = await fetch('/api/inventory/sales/for-sale?pageSize=100')
      if (forSaleRes.ok) {
        const forSaleData = await forSaleRes.json()
        setForSaleEquipment(forSaleData.equipment)
      }
    } catch (error) {
      console.error('Error cargando datos:', error)
      toast.error('Error al cargar datos del gestor de ventas')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleActivateSelected = (equipmentIds: string[]) => {
    setActivateDialog({ open: true, equipmentIds })
  }

  const handleDeactivateSelected = (equipmentIds: string[]) => {
    setDeactivateDialog({ open: true, equipmentIds })
  }

  const handleUpdatePrice = (equipmentIds: string[]) => {
    setUpdatePriceDialog({ open: true, equipmentIds })
  }

  const handleSuccess = () => {
    loadData()
  }

  const refreshHeader = useMemo(
    () => (
      <Button onClick={loadData} disabled={isLoading} variant='outline'>
        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
    ),
    [isLoading]
  )

  useSyncDashboardPageMeta({
    title: 'Gestor de Ventas',
    subtitle: 'Administra equipos disponibles y en venta pública',
    headerActions: refreshHeader,
  })

  // Filtrar equipos
  const filteredAvailable = availableEquipment.filter(eq => {
    if (!searchAvailable) return true
    const search = searchAvailable.toLowerCase()
    return (
      eq.code.toLowerCase().includes(search) ||
      eq.serialNumber?.toLowerCase().includes(search) ||
      eq.model?.brand.toLowerCase().includes(search) ||
      eq.model?.model.toLowerCase().includes(search)
    )
  })

  const filteredForSale = forSaleEquipment.filter(eq => {
    if (!searchForSale) return true
    const search = searchForSale.toLowerCase()
    return (
      eq.code.toLowerCase().includes(search) ||
      eq.serialNumber?.toLowerCase().includes(search) ||
      eq.model?.brand.toLowerCase().includes(search) ||
      eq.model?.model.toLowerCase().includes(search)
    )
  })

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Stats */}
      {stats && <SalesStatsCards stats={stats} />}

      {/* Tabs */}
      <Tabs defaultValue='available' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='available'>
            Equipos Disponibles ({filteredAvailable.length})
          </TabsTrigger>
          <TabsTrigger value='for-sale'>En Venta ({filteredForSale.length})</TabsTrigger>
          <TabsTrigger value='analytics'>Análisis</TabsTrigger>
        </TabsList>

        {/* Equipos Disponibles */}
        <TabsContent value='available' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Equipos Disponibles para Venta</CardTitle>
              <CardDescription>
                Selecciona equipos para activarlos en la vitrina pública
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='Buscar por código, serie, marca o modelo...'
                    value={searchAvailable}
                    onChange={e => setSearchAvailable(e.target.value)}
                    className='pl-8'
                  />
                </div>
              </div>

              <AvailableEquipmentTable
                equipment={filteredAvailable}
                onActivateSelected={handleActivateSelected}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Equipos En Venta */}
        <TabsContent value='for-sale' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>Equipos en Venta</CardTitle>
              <CardDescription>
                Gestiona equipos actualmente disponibles en la vitrina pública
              </CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-2 top-2.5 h-4 w-4 text-muted-foreground' />
                  <Input
                    placeholder='Buscar por código, serie, marca o modelo...'
                    value={searchForSale}
                    onChange={e => setSearchForSale(e.target.value)}
                    className='pl-8'
                  />
                </div>
              </div>

              <ForSaleEquipmentTable
                equipment={filteredForSale}
                onDeactivateSelected={handleDeactivateSelected}
                onUpdatePrice={handleUpdatePrice}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value='analytics' className='space-y-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            {/* Por Familia */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Familia</CardTitle>
                <CardDescription>Distribución de equipos en venta por familia</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.byFamily.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No hay datos disponibles</p>
                ) : (
                  <div className='space-y-2'>
                    {stats?.byFamily.map(family => (
                      <div
                        key={family.familyId}
                        className='flex items-center justify-between p-2 rounded-lg border'
                      >
                        <div>
                          <p className='font-medium'>{family.familyName}</p>
                          <p className='text-sm text-muted-foreground'>{family.count} equipo(s)</p>
                        </div>
                        <div className='text-right'>
                          <p className='font-bold'>${family.value.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Por Modelo */}
            <Card>
              <CardHeader>
                <CardTitle>Ventas por Modelo</CardTitle>
                <CardDescription>Distribución de equipos en venta por modelo</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.byModel.length === 0 ? (
                  <p className='text-sm text-muted-foreground'>No hay datos disponibles</p>
                ) : (
                  <div className='space-y-2'>
                    {stats?.byModel.map(model => (
                      <div
                        key={model.modelId}
                        className='flex items-center justify-between p-2 rounded-lg border'
                      >
                        <div>
                          <p className='font-medium'>{model.modelName}</p>
                          <p className='text-sm text-muted-foreground'>{model.count} equipo(s)</p>
                        </div>
                        <div className='text-right'>
                          <p className='font-bold'>${model.value.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ActivateSaleDialog
        open={activateDialog.open}
        onOpenChange={open => setActivateDialog({ ...activateDialog, open })}
        equipmentIds={activateDialog.equipmentIds}
        onSuccess={handleSuccess}
      />

      <DeactivateSaleDialog
        open={deactivateDialog.open}
        onOpenChange={open => setDeactivateDialog({ ...deactivateDialog, open })}
        equipmentIds={deactivateDialog.equipmentIds}
        onSuccess={handleSuccess}
      />

      <UpdatePriceDialog
        open={updatePriceDialog.open}
        onOpenChange={open => setUpdatePriceDialog({ ...updatePriceDialog, open })}
        equipmentIds={updatePriceDialog.equipmentIds}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
