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
import { XCircle, DollarSign } from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface Equipment {
  id: string
  code: string
  serialNumber: string | null
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

interface ForSaleEquipmentTableProps {
  equipment: Equipment[]
  onDeactivateSelected: (ids: string[]) => void
  onUpdatePrice: (ids: string[]) => void
  isLoading?: boolean
}

export function ForSaleEquipmentTable({
  equipment,
  onDeactivateSelected,
  onUpdatePrice,
  isLoading = false,
}: ForSaleEquipmentTableProps) {
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

  const handleDeactivate = () => {
    if (selectedIds.length > 0) {
      onDeactivateSelected(selectedIds)
      setSelectedIds([])
    }
  }

  const handleUpdatePrice = () => {
    if (selectedIds.length > 0) {
      onUpdatePrice(selectedIds)
      setSelectedIds([])
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='text-sm text-muted-foreground'>
          {selectedIds.length > 0 && <span>{selectedIds.length} equipo(s) seleccionado(s)</span>}
        </div>
        <div className='flex gap-2'>
          <Button
            onClick={handleUpdatePrice}
            disabled={selectedIds.length === 0 || isLoading}
            size='sm'
            variant='outline'
          >
            <DollarSign className='mr-2 h-4 w-4' />
            Actualizar Precio ({selectedIds.length})
          </Button>
          <Button
            onClick={handleDeactivate}
            disabled={selectedIds.length === 0 || isLoading}
            size='sm'
            variant='destructive'
          >
            <XCircle className='mr-2 h-4 w-4' />
            Desactivar ({selectedIds.length})
          </Button>
        </div>
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
              <TableHead>Precio</TableHead>
              <TableHead>Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center text-muted-foreground'>
                  No hay equipos en venta
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
                  <TableCell>
                    <Badge variant='secondary'>
                      ${eq.salePrice?.toLocaleString() || 0} {eq.saleCurrency || 'USD'}
                    </Badge>
                  </TableCell>
                  <TableCell className='max-w-xs truncate'>{eq.saleNotes || '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
