'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Package,
  FileText,
  Wrench,
  ShoppingCart,
  Key,
  DollarSign,
  Building,
  Loader2,
  Calendar,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Layers,
} from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { FamilyFilterBar } from '@/components/inventory/family-filter-bar'

const REPORT_TYPES = [
  { id: 'equipment-summary', label: 'Resumen de Equipos', icon: Package, description: 'Equipos por estado, tipo y condición' },
  { id: 'assignments', label: 'Historial de Asignaciones', icon: FileText, description: 'Asignaciones realizadas en el período' },
  { id: 'pending-acts', label: 'Actas Pendientes', icon: Clock, description: 'Actas de entrega/devolución pendientes' },
  { id: 'maintenance-costs', label: 'Costos de Mantenimiento', icon: Wrench, description: 'Gastos de mantenimiento por período' },
  { id: 'consumable-usage', label: 'Uso de Consumibles', icon: ShoppingCart, description: 'Movimientos de stock en el período' },
  { id: 'license-expiration', label: 'Vencimiento de Licencias', icon: Key, description: 'Licencias próximas a vencer' },
  { id: 'inventory-value', label: 'Valor del Inventario', icon: DollarSign, description: 'Valor total y depreciación de activos' },
  { id: 'rental-equipment', label: 'Equipos en Renta', icon: Building, description: 'Equipos rentados y costos mensuales' },
  { id: 'inventory-by-family', label: 'Inventario por Familia', icon: Layers, description: 'Conteo de activos por subtipo agrupados por familia' },
  { id: 'assets-by-acquisition', label: 'Activos por Modalidad', icon: TrendingUp, description: 'Distribución por modalidad de adquisición (Fijo/Renta/Préstamo)' },
  { id: 'contracts-status', label: 'Estado de Contratos', icon: FileText, description: 'Contratos vigentes, por vencer y vencidos' },
  { id: 'stock-movements', label: 'Movimientos de Stock MRO', icon: ShoppingCart, description: 'Entradas, salidas y ajustes de materiales MRO' },
]

export default function InventoryReportsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [selectedReport, setSelectedReport] = useState<string>('equipment-summary')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [families, setFamilies] = useState<Array<{ id: string; name: string; icon?: string | null; color?: string | null }>>([])

  useEffect(() => {
    fetch('/api/inventory/families')
      .then(r => r.json())
      .then(d => setFamilies(d.families ?? []))
      .catch(() => {})
  }, [])

  // Solo ADMIN
  if (session?.user?.role !== 'ADMIN') {
    return (
      <RoleDashboardLayout title="Reportes de Inventario">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No tienes permisos para ver reportes.</p>
        </div>
      </RoleDashboardLayout>
    )
  }

  const generateReport = async () => {
    setLoading(true)
    setReportData(null)
    try {
      const params = new URLSearchParams({ type: selectedReport })
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (selectedFamilyId) params.set('familyId', selectedFamilyId)

      const res = await fetch(`/api/inventory/reports?${params}`)
      const json = await res.json()

      if (!res.ok) throw new Error(json.error)

      setReportData(json)
      toast({ title: 'Reporte generado', description: `Reporte "${REPORT_TYPES.find(r => r.id === selectedReport)?.label}" generado correctamente.` })
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'No se pudo generar el reporte', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    if (!reportData?.data) return
    const data = reportData.data
    const rows = data.rows ?? data.contracts ?? data.movements ?? data.equipment ?? []
    if (!Array.isArray(rows) || rows.length === 0) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${selectedReport}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    const headers = Object.keys(rows[0]).join(',')
    const csvRows = rows.map((r: any) => Object.values(r).map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    const csv = [headers, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-${selectedReport}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <RoleDashboardLayout title="Reportes de Inventario" subtitle="Análisis y estadísticas del inventario">
      <div className="space-y-6">
        {/* Filtro por familia */}
        {families.length > 0 && (
          <FamilyFilterBar
            families={families}
            selectedId={selectedFamilyId}
            onChange={setSelectedFamilyId}
          />
        )}

        {/* Selector de reporte */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Generar Reporte
            </CardTitle>
            <CardDescription>Selecciona el tipo de reporte y el rango de fechas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-1 block">Tipo de Reporte</label>
                <Select value={selectedReport} onValueChange={setSelectedReport}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="flex items-center gap-2">
                          <r.icon className="h-4 w-4" />
                          {r.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Desde</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[160px]" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Hasta</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[160px]" />
              </div>
              <Button onClick={generateReport} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Generar
              </Button>
              {reportData && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {REPORT_TYPES.find(r => r.id === selectedReport)?.description}
            </p>
          </CardContent>
        </Card>

        {/* Tarjetas de tipos de reporte */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {REPORT_TYPES.map(r => (
            <Card
              key={r.id}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${selectedReport === r.id ? 'border-primary bg-primary/5' : ''}`}
              onClick={() => setSelectedReport(r.id)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <r.icon className={`h-5 w-5 ${selectedReport === r.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">{r.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Resultados */}
        {reportData && <ReportResults reportType={selectedReport} data={reportData.data} />}
      </div>
    </RoleDashboardLayout>
  )
}

function ReportResults({ reportType, data }: { reportType: string; data: any }) {
  if (!data) return null

  switch (reportType) {
    case 'equipment-summary':
      return <EquipmentSummaryReport data={data} />
    case 'pending-acts':
      return <PendingActsReport data={data} />
    case 'inventory-value':
      return <InventoryValueReport data={data} />
    case 'license-expiration':
      return <LicenseExpirationReport data={data} />
    case 'inventory-by-family':
      return <InventoryByFamilyReport data={data} />
    case 'assets-by-acquisition':
      return <AssetsByAcquisitionReport data={data} />
    case 'contracts-status':
      return <ContractsStatusReport data={data} />
    case 'stock-movements':
      return <StockMovementsReport data={data} />
    default:
      return <GenericReport data={data} />
  }
}

function EquipmentSummaryReport({ data }: { data: any }) {
  const statusLabels: Record<string, string> = {
    AVAILABLE: 'Disponible', ASSIGNED: 'Asignado', MAINTENANCE: 'En Mantenimiento',
    DAMAGED: 'Dañado', RETIRED: 'Retirado',
  }
  const conditionLabels: Record<string, string> = {
    NEW: 'Nuevo', LIKE_NEW: 'Como Nuevo', GOOD: 'Bueno', FAIR: 'Regular', POOR: 'Malo',
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumen General</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{data.total}</p>
              <p className="text-sm text-muted-foreground">Total Equipos</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-green-600">${Number(data.totalValue?._sum?.purchasePrice || 0).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Valor Total</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{data.byStatus?.ASSIGNED || 0}</p>
              <p className="text-sm text-muted-foreground">Asignados</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{data.byStatus?.AVAILABLE || 0}</p>
              <p className="text-sm text-muted-foreground">Disponibles</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Por Estado</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center">
                  <span className="text-sm">{statusLabels[status] || status}</span>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por Condición</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(data.byCondition || {}).map(([cond, count]) => (
                <div key={cond} className="flex justify-between items-center">
                  <span className="text-sm">{conditionLabels[cond] || cond}</span>
                  <Badge variant="secondary">{count as number}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PendingActsReport({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Actas Pendientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{data.pendingDeliveryActs?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Actas Entrega Pendientes</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{data.expiredDeliveryActs?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Actas Expiradas</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{data.pendingReturnActs?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Actas Devolución Pendientes</p>
          </div>
        </div>
        {data.pendingDeliveryActs?.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Actas de Entrega Pendientes</h4>
            {data.pendingDeliveryActs.map((act: any) => (
              <div key={act.id} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                <span>{act.folio}</span>
                <span className="text-muted-foreground">{act.receiverInfo?.name || 'N/A'}</span>
                <Badge variant={new Date(act.expiresAt) < new Date() ? 'destructive' : 'outline'}>
                  {new Date(act.expiresAt).toLocaleDateString('es-MX')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InventoryValueReport({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Valor del Inventario
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <p className="text-2xl font-bold">{data.fixedAssets?.count || 0}</p>
            <p className="text-sm text-muted-foreground">Activos Fijos</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-2xl font-bold text-green-600">${Number(data.fixedAssets?.value || 0).toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Valor Activos</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">${Number(data.rentals?.monthlyCost || 0).toLocaleString()}/mes</p>
            <p className="text-sm text-muted-foreground">Rentas ({data.rentals?.count || 0} equipos)</p>
          </div>
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <p className="text-2xl font-bold text-orange-600">${Number(data.total?.assetValue || 0).toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Valor Total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LicenseExpirationReport({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Licencias por Vencer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{data.expired?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Vencidas</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{data.expiringSoon?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Por Vencer</p>
          </div>
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{data.active?.length || 0}</p>
            <p className="text-sm text-muted-foreground">Activas</p>
          </div>
        </div>
        {(data.expired?.length > 0 || data.expiringSoon?.length > 0) && (
          <div className="space-y-2">
            {[...(data.expired || []), ...(data.expiringSoon || [])].map((lic: any) => (
              <div key={lic.id} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
                <span className="font-medium">{lic.name}</span>
                <span className="text-muted-foreground">{lic.type}</span>
                <Badge variant={new Date(lic.expirationDate) < new Date() ? 'destructive' : 'outline'}>
                  {new Date(lic.expirationDate).toLocaleDateString('es-MX')}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GenericReport({ data }: { data: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del Reporte</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[500px] text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

function InventoryByFamilyReport({ data }: { data: any }) {
  const rows: Array<{ familyName: string; EQUIPMENT: number; MRO: number; LICENSE: number; total: number }> = data?.rows ?? []
  return (
    <Card>
      <CardHeader><CardTitle>Inventario por Familia</CardTitle></CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead><tr className="border-b"><th className="text-left py-2">Familia</th><th className="text-center py-2">Equipos</th><th className="text-center py-2">MRO</th><th className="text-center py-2">Licencias</th><th className="text-center py-2">Total</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-2">{r.familyName}</td>
                <td className="py-2 text-center">{r.EQUIPMENT}</td>
                <td className="py-2 text-center">{r.MRO}</td>
                <td className="py-2 text-center">{r.LICENSE}</td>
                <td className="py-2 text-center font-medium">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function AssetsByAcquisitionReport({ data }: { data: any }) {
  const modeLabels: Record<string, string> = { FIXED_ASSET: 'Activo Fijo', RENTAL: 'Arrendamiento', LOAN: 'Activo de Tercero' }
  const rows: Array<{ acquisitionMode: string; count: number; totalValue: number }> = data?.rows ?? []
  return (
    <Card>
      <CardHeader><CardTitle>Activos por Modalidad de Adquisición</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="text-sm font-medium">{modeLabels[r.acquisitionMode] ?? r.acquisitionMode}</span>
              <div className="flex gap-4 text-sm">
                <span>{r.count} activos</span>
                {r.totalValue > 0 && <span className="text-muted-foreground">${r.totalValue.toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ContractsStatusReport({ data }: { data: any }) {
  const contracts: Array<{ id: string; name: string; expirationDate: string | null; status: string }> = data?.contracts ?? []
  return (
    <Card>
      <CardHeader><CardTitle>Estado de Contratos</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{data?.summary?.active ?? 0}</p>
            <p className="text-sm text-muted-foreground">Vigentes</p>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{data?.summary?.expiringSoon ?? 0}</p>
            <p className="text-sm text-muted-foreground">Por vencer</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{data?.summary?.expired ?? 0}</p>
            <p className="text-sm text-muted-foreground">Vencidos</p>
          </div>
        </div>
        <div className="space-y-2">
          {contracts.slice(0, 20).map(c => (
            <div key={c.id} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
              <span className="font-medium">{c.name}</span>
              <Badge variant={c.status === 'expired' ? 'destructive' : c.status === 'expiring' ? 'outline' : 'secondary'}>
                {c.expirationDate ? new Date(c.expirationDate).toLocaleDateString('es-CL') : 'Sin fecha'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function StockMovementsReport({ data }: { data: any }) {
  const movements: Array<{ id: string; name: string; type: string; quantity: number; createdAt: string }> = data?.movements ?? []
  const typeLabels: Record<string, string> = { ENTRY: 'Entrada', EXIT: 'Salida', ADJUSTMENT: 'Ajuste' }
  return (
    <Card>
      <CardHeader><CardTitle>Movimientos de Stock MRO</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{data?.summary?.entries ?? 0}</p>
            <p className="text-sm text-muted-foreground">Entradas</p>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{data?.summary?.exits ?? 0}</p>
            <p className="text-sm text-muted-foreground">Salidas</p>
          </div>
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{data?.summary?.adjustments ?? 0}</p>
            <p className="text-sm text-muted-foreground">Ajustes</p>
          </div>
        </div>
        <div className="space-y-1">
          {movements.slice(0, 20).map(m => (
            <div key={m.id} className="flex justify-between items-center p-2 bg-muted rounded text-sm">
              <span>{m.name}</span>
              <Badge variant="outline">{typeLabels[m.type] ?? m.type}</Badge>
              <span className="font-medium">{m.quantity}</span>
              <span className="text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('es-CL')}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
