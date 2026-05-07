'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart } from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface Equipment {
  id: string
  code: string
  serialNumber: string | null
  status: string
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

interface AvailableEquipmentTableProps {
  equipment: Equipment[]
  onActivateSelected: (ids: string[]) => void
  isLoading?: boolean
}

export function AvailableEquipmentTable({
  equipment,
  onActivateSelected,
  isLoading = false,
}: AvailableEquipmentTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const toggleAll = () => {
    if (selectedIds.length === equipment.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(equipment.map(e => e.id))
    }
  }

  const handleActivate = () => {
    if (selectedIds.length > 0) {
      onActivateSelected(selectedIds)
      setSelectedIds([])
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          {selectedIds.length > 0 && <span>{selectedIds.length} equipo(s) seleccionado(s)</span>}
        </div>
        <Button onClick={handleActivate} disabled={selectedIds.length === 0 || isLoading} size='sm'>
          <ShoppingCart className='mr-2 h-4 w-4' />
          Activar para Venta ({selectedIds.length})
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-12'>
                <Checkbox
                  checked={selectedIds.length === equipment.length && equipment.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Serie</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Familia</TableHead>
              <TableHead>Bodega</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center text-muted-foreground'>
                  No hay equipos disponibles
                </TableCell>
              </TableRow>
            ) : (
              equipment.map(eq => (
                <TableRow key={eq.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(eq.id)}
                      onCheckedChange={() => toggleSelection(eq.id)}
                    />
                  </TableCell>
                  <TableCell className='font-medium'>{eq.code}</TableCell>
                  <TableCell>{eq.serialNumber || '-'}</TableCell>
                  <TableCell>{eq.model ? `${eq.model.brand} ${eq.model.model}` : '-'}</TableCell>
                  <TableCell>
                    {eq.family ? (
                      <FamilyBadge name={eq.family.name} color={eq.family.color || undefined} />
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{eq.warehouse?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={eq.status === 'AVAILABLE' ? 'default' : 'secondary'}>
                      {eq.status === 'AVAILABLE' ? 'Disponible' : 'Asignado'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
