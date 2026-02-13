'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  Shield, 
  Activity, 
  Users, 
  FileText, 
  Download,
  Calendar,
  Filter,
  Search,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'

// Componentes
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/ui/data-table'
import { SymmetricStatsCard } from '@/components/shared/stats-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId?: string
  userId: string
  userEmail?: string
  details?: any
  ipAddress?: string
  userAgent?: string
  createdAt: string
  users?: {
    name: string
    email: string
    role: string
  }
}

interface AuditStats {
  totalLogs: number
  actionStats: Array<{
    action: string
    entityType: string
    _count: { id: number }
  }>
  topUsers: Array<{
    userId: string
    _count: { id: number }
  }>
  period: string
}

export default function AuditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  // Estados
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    hasMore: false
  })
  const [filters, setFilters] = useState({
    search: '',
    entityType: 'all',
    action: '',
    userId: '',
    days: '30'
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    loadAuditData()
  }, [session, status, router, filters])

  const loadAuditData = async (page = 1, limit = 50) => {
    try {
      setLoading(true)
      
      // Cargar logs con paginación
      const logsResponse = await fetch('/api/admin/audit/logs?' + new URLSearchParams({
        ...filters,
        limit: limit.toString(),
        offset: ((page - 1) * limit).toString()
      }))
      
      if (logsResponse.ok) {
        const logsData = await logsResponse.json()
        setLogs(logsData.logs || [])
        setPagination({
          page,
          limit,
          total: logsData.total || 0,
          hasMore: logsData.hasMore || false
        })
      }

      // Cargar estadísticas solo en la primera página
      if (page === 1) {
        const statsResponse = await fetch(`/api/admin/audit/stats?days=${filters.days}`)
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }
      }

    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los datos de auditoría',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const exportAuditReport = async () => {
    try {
      const response = await fetch('/api/admin/audit/export?' + new URLSearchParams(filters))
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `audit-report-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast({
          title: 'Éxito',
          description: 'Reporte de auditoría exportado correctamente'
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo exportar el reporte',
        variant: 'destructive'
      })
    }
  }

  const auditColumns = [
    {
      key: 'createdAt',
      label: 'Fecha',
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }: any) => {
        const date = new Date(row.getValue('createdAt'))
        return (
          <div className="text-sm">
            <div>{date.toLocaleDateString()}</div>
            <div className="text-muted-foreground text-xs">
              {date.toLocaleTimeString()}
            </div>
          </div>
        )
      }
    },
    {
      key: 'action',
      label: 'Acción',
      accessorKey: 'action',
      header: 'Acción',
      cell: ({ row }: any) => {
        const action = row.getValue('action')
        const entityType = row.original.entityType
        
        const getActionColor = (action: string) => {
          if (action.includes('created')) return 'bg-green-100 text-green-800'
          if (action.includes('updated')) return 'bg-blue-100 text-blue-800'
          if (action.includes('deleted')) return 'bg-red-100 text-red-800'
          if (action.includes('login')) return 'bg-purple-100 text-purple-800'
          return 'bg-gray-100 text-gray-800'
        }

        return (
          <div className="space-y-1">
            <Badge className={getActionColor(action)}>
              {action.replace('_', ' ')}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {entityType}
            </div>
          </div>
        )
      }
    },
    {
      key: 'users',
      label: 'Usuario',
      accessorKey: 'users',
      header: 'Usuario',
      cell: ({ row }: any) => {
        const user = row.getValue('users')
        if (!user) return <span className="text-muted-foreground">Sistema</span>
        
        return (
          <div className="text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground text-xs">{user.email}</div>
            <Badge variant="outline" className="text-xs">
              {user.role}
            </Badge>
          </div>
        )
      }
    },
    {
      key: 'entityId',
      label: 'Entidad',
      accessorKey: 'entityId',
      header: 'Entidad',
      cell: ({ row }: any) => {
        const entityId = row.getValue('entityId')
        const entityType = row.original.entityType
        
        if (!entityId) return <span className="text-muted-foreground">-</span>
        
        return (
          <div className="text-sm">
            <div className="font-mono text-xs">{entityId.slice(0, 8)}...</div>
            <div className="text-muted-foreground text-xs">{entityType}</div>
          </div>
        )
      }
    },
    {
      key: 'ipAddress',
      label: 'IP',
      accessorKey: 'ipAddress',
      header: 'IP',
      cell: ({ row }: any) => {
        const ip = row.getValue('ipAddress')
        return ip ? (
          <span className="font-mono text-xs">{ip}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )
      }
    },
    {
      key: 'actions',
      label: 'Acciones',
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }: any) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              // Mostrar detalles del log
              console.log('Ver detalles:', row.original)
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )
      }
    }
  ]

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <ModuleLayout
      title="Sistema de Auditoría"
      subtitle="Monitoreo y logs de actividad del sistema"
      loading={loading}
    >
      <div className="space-y-6">
        
        {/* Estadísticas de Auditoría */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SymmetricStatsCard
            title="Total de Logs"
            value={stats?.totalLogs || 0}
            icon={FileText}
            color="blue"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Acciones de Usuario"
            value={stats?.actionStats?.filter(s => s.action.includes('user')).length || 0}
            icon={Users}
            color="green"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Actividad de Tickets"
            value={stats?.actionStats?.filter(s => s.entityType === 'ticket').length || 0}
            icon={Activity}
            color="orange"
            role="ADMIN"
          />
          
          <SymmetricStatsCard
            title="Eventos de Sistema"
            value={stats?.actionStats?.filter(s => s.entityType === 'system').length || 0}
            icon={Shield}
            color="purple"
            role="ADMIN"
          />
        </div>

        {/* Filtros de Auditoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros de Auditoría
            </CardTitle>
            <CardDescription>
              Filtra los logs de auditoría por diferentes criterios. Máximo 50,000 registros por exportación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              
              {/* Búsqueda */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Búsqueda</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Buscar en logs..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Tipo de Entidad */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Módulo</label>
                <Select 
                  value={filters.entityType} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Módulos</SelectItem>
                    <SelectItem value="ticket">🎫 Tickets</SelectItem>
                    <SelectItem value="user">👥 Usuarios</SelectItem>
                    <SelectItem value="category">📂 Categorías</SelectItem>
                    <SelectItem value="department">🏢 Departamentos</SelectItem>
                    <SelectItem value="technician">🔧 Técnicos</SelectItem>
                    <SelectItem value="system">⚙️ Sistema</SelectItem>
                    <SelectItem value="report">📊 Reportes</SelectItem>
                    <SelectItem value="settings">🛠️ Configuración</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Período */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select 
                  value={filters.days} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, days: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Último día</SelectItem>
                    <SelectItem value="7">Última semana</SelectItem>
                    <SelectItem value="30">Último mes</SelectItem>
                    <SelectItem value="90">Últimos 3 meses</SelectItem>
                    <SelectItem value="180">Últimos 6 meses</SelectItem>
                    <SelectItem value="365">Último año</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Acción */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Acción</label>
                <Input
                  placeholder="Ej: created, updated..."
                  value={filters.action}
                  onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                />
              </div>

              {/* Exportar */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Exportar</label>
                <div className="flex gap-2">
                  <Button 
                    onClick={exportAuditReport}
                    className="flex-1"
                    variant="outline"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </Button>
                </div>
              </div>

              {/* Limpiar Filtros */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Acciones</label>
                <Button 
                  onClick={() => setFilters({
                    search: '',
                    entityType: 'all',
                    action: '',
                    userId: '',
                    days: '30'
                  })}
                  variant="outline"
                  size="sm"
                  className="w-full"
                >
                  Limpiar
                </Button>
              </div>
            </div>
            
            {/* Información de filtros activos */}
            {(filters.search || filters.entityType !== 'all' || filters.action || filters.days !== '30') && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Filtros activos:</strong>
                  {filters.search && ` Búsqueda: "${filters.search}"`}
                  {filters.entityType !== 'all' && ` | Módulo: ${filters.entityType}`}
                  {filters.action && ` | Acción: "${filters.action}"`}
                  {filters.days !== '30' && ` | Período: ${filters.days} días`}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabla de Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Logs de Auditoría
            </CardTitle>
            <CardDescription>
              Registro detallado de todas las actividades del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={logs}
              columns={auditColumns}
              loading={loading}
              searchable={false}
              pagination={{
                page: pagination.page,
                limit: pagination.limit,
                total: pagination.total,
                onPageChange: (page) => loadAuditData(page, pagination.limit),
                onLimitChange: (limit) => loadAuditData(1, limit)
              }}
              emptyState={{
                icon: <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
                title: "No hay logs de auditoría",
                description: "No se encontraron registros con los filtros aplicados"
              }}
            />
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}