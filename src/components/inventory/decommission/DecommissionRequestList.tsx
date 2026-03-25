'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING:  { label: 'Pendiente', variant: 'outline' },
  APPROVED: { label: 'Aprobada',  variant: 'default' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  EQUIPMENT: 'Equipo',
  LICENSE: 'Licencia',
}

interface DecommissionRequestListProps {
  onViewDetail?: (request: any) => void
  refreshTrigger?: number
}

export function DecommissionRequestList({ onViewDetail, refreshTrigger }: DecommissionRequestListProps) {
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
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [statusFilter, assetTypeFilter])

  useEffect(() => { fetchRequests() }, [fetchRequests, refreshTrigger])

  const getAssetName = (req: any) => {
    if (req.equipment) return `${req.equipment.code} — ${req.equipment.brand} ${req.equipment.model}`
    if (req.license) return req.license.name
    return '—'
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{total} solicitud{total !== 1 ? 'es' : ''}</p>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendientes</SelectItem>
              <SelectItem value="APPROVED">Aprobadas</SelectItem>
              <SelectItem value="REJECTED">Rechazadas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="EQUIPMENT">Equipos</SelectItem>
              <SelectItem value="LICENSE">Licencias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchRequests} title="Actualizar">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Activo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : requests.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay solicitudes de baja</TableCell></TableRow>
            ) : requests.map(req => (
              <TableRow key={req.id}>
                <TableCell className="font-medium max-w-[200px] truncate">{getAssetName(req)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{ASSET_TYPE_LABELS[req.assetType] || req.assetType}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{req.requester?.name || req.requester?.email || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(req.createdAt)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_CONFIG[req.status]?.variant || 'outline'}>
                    {STATUS_CONFIG[req.status]?.label || req.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => onViewDetail?.(req)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
