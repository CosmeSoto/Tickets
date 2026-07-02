'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { Download, ArrowUpDown } from 'lucide-react'
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
  physicalLocation?: string | null
  warehouse?: { name: string } | null
  department?: { name: string } | null
  assignments?: Array<{ receiver?: { name: string } | null; returnedAt?: Date | null }>
}

interface BatchEquipmentListProps {
  equipment: Equipment[]
}

const STATUS_LABELS: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = STATUS_CONFIG

type SortField = 'code' | 'status' | 'location'
type SortDir = 'asc' | 'desc'

export function BatchEquipmentList({ equipment }: BatchEquipmentListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('code')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const filtered = equipment
    .filter(e => statusFilter === 'all' || e.status === statusFilter)
    .sort((a, b) => {
      let valA = ''
      let valB = ''
      if (sortField === 'code') {
        valA = a.code
        valB = b.code
      }
      if (sortField === 'status') {
        valA = a.status
        valB = b.status
      }
      if (sortField === 'location') {
        valA = a.physicalLocation || a.location || ''
        valB = b.physicalLocation || b.location || ''
      }
      return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleExport = () => {
    const rows = [
      ['Código', 'Serial', 'Estado', 'Ubicación', 'Bodega', 'Departamento'],
      ...filtered.map(e => [
        e.code,
        e.serialNumber || '',
        STATUS_LABELS[e.status]?.label || e.status,
        e.physicalLocation || e.location || '',
        e.warehouse?.name || '',
        e.department?.name || '',
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'equipos-lote.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className='w-48'>
            <SelectValue placeholder='Filtrar por estado' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos los estados</SelectItem>
            <SelectItem value='AVAILABLE'>Disponible</SelectItem>
            <SelectItem value='ASSIGNED'>Asignado</SelectItem>
            <SelectItem value='MAINTENANCE'>Mantenimiento</SelectItem>
            <SelectItem value='RETIRED'>Retirado</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant='outline'
          size='sm'
          onClick={handleExport}
          className='flex items-center gap-2'
        >
          <Download className='w-4 h-4' />
          Exportar CSV
        </Button>
      </div>

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
              <TableHead>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => toggleSort('location')}
                  className='flex items-center gap-1 -ml-3'
                >
                  Ubicación <ArrowUpDown className='w-3 h-3' />
                </Button>
              </TableHead>
              <TableHead>Bodega</TableHead>
              <TableHead>Departamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                  No hay equipos con el filtro seleccionado
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(eq => {
                const location = eq.physicalLocation || eq.location
                return (
                  <TableRow key={eq.id} className='hover:bg-muted/50'>
                    <TableCell className='font-mono font-medium'>
                      <Link
                        href={`/inventory/equipment/${eq.id}`}
                        className='text-primary hover:underline'
                        onClick={e => e.stopPropagation()}
                      >
                        {eq.code}
                      </Link>
                    </TableCell>
                    <TableCell className='font-mono text-sm text-muted-foreground'>
                      {eq.serialNumber || '—'}
                    </TableCell>
                    <TableCell>
                      <EquipmentStatusBadge status={eq.status} />
                    </TableCell>
                    <TableCell>{location || '—'}</TableCell>
                    <TableCell>{eq.warehouse?.name || '—'}</TableCell>
                    <TableCell>{eq.department?.name || '—'}</TableCell>
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
