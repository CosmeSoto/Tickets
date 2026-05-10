'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { ArrowUpDown, Search, Download } from 'lucide-react'
import Link from 'next/link'
import { BatchBadge } from '@/components/inventory/dashboard/BatchBadge'
import {
  EquipmentStatusBadge,
  STATUS_CONFIG,
} from '@/components/inventory/shared/EquipmentStatusBadge'

interface Equipment {
  id: string
  code: string
  serialNumber?: string | null
  status: string
  location?: string | null
  batchId?: string | null
  department?: { name: string } | null
  warehouse?: { name: string } | null
}

interface ModelEquipmentTableProps {
  equipment: Equipment[]
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = STATUS_CONFIG

type SortField = 'code' | 'status' | 'department'

export function ModelEquipmentTable({ equipment }: ModelEquipmentTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [batchFilter, setBatchFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('code')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Lotes únicos para el filtro
  const uniqueBatches = Array.from(new Set(equipment.filter(e => e.batchId).map(e => e.batchId!)))

  const filtered = equipment
    .filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (batchFilter === 'none' && e.batchId) return false
      if (batchFilter !== 'all' && batchFilter !== 'none' && e.batchId !== batchFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          e.code.toLowerCase().includes(q) ||
          (e.serialNumber || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let va = '',
        vb = ''
      if (sortField === 'code') {
        va = a.code
        vb = b.code
      }
      if (sortField === 'status') {
        va = a.status
        vb = b.status
      }
      if (sortField === 'department') {
        va = a.department?.name || ''
        vb = b.department?.name || ''
      }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
    })

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleExport = () => {
    const rows = [
      ['Código', 'Serial', 'Estado', 'Lote', 'Ubicación', 'Bodega', 'Departamento'],
      ...filtered.map(e => [
        e.code,
        e.serialNumber || '',
        STATUS_LABELS[e.status]?.label || e.status,
        e.batchId || 'Individual',
        e.location || '',
        e.warehouse?.name || '',
        e.department?.name || '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'equipos-modelo.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='space-y-4'>
      {/* Filtros */}
      <div className='flex flex-wrap gap-3'>
        <div className='relative flex-1 min-w-48'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
          <Input
            placeholder='Buscar código, serial...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-44'>
            <SelectValue placeholder='Estado' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            <SelectItem value='AVAILABLE'>Disponible</SelectItem>
            <SelectItem value='ASSIGNED'>Asignado</SelectItem>
            <SelectItem value='MAINTENANCE'>Mantenimiento</SelectItem>
            <SelectItem value='RETIRED'>Retirado</SelectItem>
          </SelectContent>
        </Select>

        {uniqueBatches.length > 0 && (
          <Select value={batchFilter} onValueChange={setBatchFilter}>
            <SelectTrigger className='w-44'>
              <SelectValue placeholder='Lote' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todos</SelectItem>
              <SelectItem value='none'>Sin lote</SelectItem>
              {uniqueBatches.map(id => (
                <SelectItem key={id} value={id}>
                  Lote {id.slice(0, 8)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button
          variant='outline'
          size='sm'
          onClick={handleExport}
          className='flex items-center gap-2'
        >
          <Download className='w-4 h-4' />
          CSV
        </Button>
      </div>

      {/* Tabla */}
      <div className='rounded-md border overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => toggleSort('code')}
                  className='flex items-center gap-1 -ml-3'
                >
                  Código <ArrowUpDown className='w-3 h-3' />
                </Button>
              </TableHead>
              <TableHead>Serial</TableHead>
              <TableHead>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => toggleSort('status')}
                  className='flex items-center gap-1 -ml-3'
                >
                  Estado <ArrowUpDown className='w-3 h-3' />
                </Button>
              </TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => toggleSort('department')}
                  className='flex items-center gap-1 -ml-3'
                >
                  Departamento <ArrowUpDown className='w-3 h-3' />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                  No hay equipos con los filtros seleccionados
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(eq => {
                return (
                  <TableRow key={eq.id} className='hover:bg-muted/50'>
                    <TableCell className='font-mono font-medium'>{eq.code}</TableCell>
                    <TableCell className='font-mono text-sm text-muted-foreground'>
                      {eq.serialNumber || '—'}
                    </TableCell>
                    <TableCell>
                      <EquipmentStatusBadge status={eq.status} />
                    </TableCell>
                    <TableCell>
                      {eq.batchId ? (
                        <BatchBadge batchId={eq.batchId} />
                      ) : (
                        <span className='text-xs text-muted-foreground'>Individual</span>
                      )}
                    </TableCell>
                    <TableCell className='text-sm'>{eq.location || '—'}</TableCell>
                    <TableCell className='text-sm'>{eq.department?.name || '—'}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className='text-sm text-muted-foreground'>
        Mostrando {filtered.length} de {equipment.length} equipos
      </p>
    </div>
  )
}
