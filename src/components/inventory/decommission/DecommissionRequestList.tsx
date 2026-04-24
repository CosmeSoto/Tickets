'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, RefreshCw, Wrench, ArrowUpCircle, Clock, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useTableSort, SortIcon, sortableHeaderClass } from '@/hooks/common/use-table-sort'

const STATUS_CONFIG: Record<
  string,
  {
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    color: string
    icon: React.ElementType
  }
> = {
  PENDING: { label: 'Pendiente', variant: 'outline', color: 'text-amber-600', icon: Clock },
  TECHNICAL_REVIEW: {
    label: 'Dictamen técnico',
    variant: 'outline',
    color: 'text-blue-600',
    icon: Wrench,
  },
  MANAGER_REVIEW: {
    label: 'En revisión',
    variant: 'outline',
    color: 'text-purple-600',
    icon: ArrowUpCircle,
  },
  APPROVED: { label: 'Aprobada', variant: 'default', color: 'text-green-600', icon: CheckCircle },
  REJECTED: { label: 'Rechazada', variant: 'destructive', color: 'text-red-600', icon: XCircle },
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Equipo',
  LICENSE: 'Licencia',
}

interface DecommissionRequestListProps {
  onViewDetail?: (request: any) => void
  refreshTrigger?: number
}

export function DecommissionRequestList({
  onViewDetail,
  refreshTrigger,
}: DecommissionRequestListProps) {
  const [requests, setRequests] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [assetTypeFilter, setAssetTypeFilter] = useState('all')

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (assetTypeFilter !== 'all') params.set('assetType', assetTypeFilter)
    params.set('limit', '50')
    try {
      const res = await fetch(`/api/inventory/decommission-acts?${params}`)
      const data = await res.json()
      setRequests(data.requests || [])
      setTotal(data.total || 0)
    } catch {
      /* silencioso */
    } finally {
      setLoading(false)
    }
  }, [statusFilter, assetTypeFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests, refreshTrigger])

  const getAssetName = (req: any) => {
    if (req.equipment)
      return `${req.equipment.code} — ${req.equipment.brand} ${req.equipment.model}`
    if (req.license) return req.license.name
    return '—'
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('es-EC', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })

  // Contar pendientes de acción
  const pendingAction = requests.filter(r =>
    ['PENDING', 'TECHNICAL_REVIEW', 'MANAGER_REVIEW'].includes(r.status)
  ).length

  const {
    sorted: sortedRequests,
    sortKey,
    sortDir,
    toggleSort,
  } = useTableSort(requests, 'createdAt', 'desc')

  return (
    <div className='space-y-4'>
      {/* Banner de pendientes */}
      {pendingAction > 0 && (
        <div className='rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-2 text-sm text-amber-800'>
          <Clock className='h-4 w-4 shrink-0' />
          {pendingAction} solicitud{pendingAction > 1 ? 'es' : ''} en proceso de revisión
        </div>
      )}

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-sm text-muted-foreground'>
          {total} solicitud{total !== 1 ? 'es' : ''}
        </p>
        <div className='flex gap-2 flex-wrap'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='Estado' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos los estados</SelectItem>
              <SelectItem value='PENDING'>Pendiente</SelectItem>
              <SelectItem value='TECHNICAL_REVIEW'>Dictamen técnico</SelectItem>
              <SelectItem value='MANAGER_REVIEW'>En revisión</SelectItem>
              <SelectItem value='APPROVED'>Aprobadas</SelectItem>
              <SelectItem value='REJECTED'>Rechazadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
            <SelectTrigger className='w-36'>
              <SelectValue placeholder='Tipo' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              <SelectItem value='EQUIPMENT'>Equipos</SelectItem>
              <SelectItem value='LICENSE'>Licencias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant='outline'
            size='icon'
            onClick={fetchRequests}
            title='Actualizar'
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={sortableHeaderClass} onClick={() => toggleSort('assetType')}>
                Activo {SortIcon('assetType', sortKey, sortDir)}
              </TableHead>
              <TableHead className='hidden md:table-cell'>Tipo</TableHead>
              <TableHead className='hidden sm:table-cell'>Solicitante</TableHead>
              <TableHead className={sortableHeaderClass} onClick={() => toggleSort('status')}>
                Estado {SortIcon('status', sortKey, sortDir)}
              </TableHead>
              <TableHead className='hidden lg:table-cell'>Técnico</TableHead>
              <TableHead className='hidden lg:table-cell'>Gestor</TableHead>
              <TableHead
                className={`hidden md:table-cell ${sortableHeaderClass}`}
                onClick={() => toggleSort('createdAt')}
              >
                Fecha {SortIcon('createdAt', sortKey, sortDir)}
              </TableHead>
              <TableHead className='text-right'>Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className='text-center py-8 text-muted-foreground'>
                  <RefreshCw className='h-4 w-4 animate-spin mx-auto mb-2' />
                  Cargando...
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className='text-center py-8 text-muted-foreground'>
                  No hay solicitudes de baja
                </TableCell>
              </TableRow>
            ) : (
              sortedRequests.map(req => {
                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING
                const Icon = cfg.icon
                const isActive = ['PENDING', 'TECHNICAL_REVIEW', 'MANAGER_REVIEW'].includes(
                  req.status
                )
                return (
                  <TableRow
                    key={req.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      isActive && 'bg-amber-50/30 dark:bg-amber-950/10'
                    )}
                    onClick={() => onViewDetail?.(req)}
                  >
                    <TableCell className='font-medium max-w-[180px] truncate'>
                      {getAssetName(req)}
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      <Badge variant='outline' className='text-xs'>
                        {ASSET_TYPE_LABELS[req.assetType] || req.assetType}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground hidden sm:table-cell'>
                      {req.requester?.name || req.requester?.email || '—'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-medium',
                          cfg.color
                        )}
                      >
                        <Icon className='h-3 w-3' />
                        <span className='hidden sm:inline'>{cfg.label}</span>
                      </span>
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden lg:table-cell'>
                      {req.technician?.name || (req.technicianOpinion ? '✓' : '—')}
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden lg:table-cell'>
                      {req.manager?.name || (req.managerNotes ? '✓' : '—')}
                    </TableCell>
                    <TableCell className='text-xs text-muted-foreground hidden md:table-cell'>
                      {fmtDate(req.createdAt)}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='ghost'
                        size='icon'
                        title='Ver detalle'
                        onClick={e => {
                          e.stopPropagation()
                          onViewDetail?.(req)
                        }}
                      >
                        <Eye className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
