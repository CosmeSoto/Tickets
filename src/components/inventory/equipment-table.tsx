'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, Trash2, QrCode } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EquipmentCondition } from '@prisma/client'
import type { Equipment } from '@/types/inventory/equipment'
import { useTableSort, SortIcon, sortableHeaderClass } from '@/hooks/common/use-table-sort'

interface EquipmentTableProps {
  equipment: Equipment[]
  userRole: string
  canManageInventory?: boolean
  onEdit?: (equipment: Equipment) => void
  onDelete?: (equipment: Equipment) => void
  onViewQR?: (equipment: Equipment) => void
}

import { getAssetStatusColor, getAssetStatusLabel } from '@/lib/utils/inventory-utils'

const CONDITION_COLORS: Record<EquipmentCondition, string> = {
  NEW: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  LIKE_NEW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  GOOD: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  FAIR: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  POOR: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const CONDITION_LABELS: Record<EquipmentCondition, string> = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como Nuevo',
  GOOD: 'Bueno',
  FAIR: 'Regular',
  POOR: 'Malo',
}

export function EquipmentTable({
  equipment,
  userRole,
  canManageInventory = false,
  onDelete,
  onViewQR,
}: Omit<EquipmentTableProps, 'onEdit'> & { onEdit?: (e: Equipment) => void }) {
  const router = useRouter()
  const isAdmin = userRole === 'ADMIN'
  const canDelete = isAdmin || canManageInventory

  const { sorted, sortKey, sortDir, toggleSort } = useTableSort(equipment, 'code')

  if (equipment.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center'>
        <p className='text-sm text-muted-foreground'>No se encontraron equipos</p>
      </div>
    )
  }

  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={sortableHeaderClass} onClick={() => toggleSort('code')}>
              Código {SortIcon('code', sortKey, sortDir)}
            </TableHead>
            <TableHead className={sortableHeaderClass} onClick={() => toggleSort('brand')}>
              Equipo {SortIcon('brand', sortKey, sortDir)}
            </TableHead>
            <TableHead className='hidden md:table-cell'>Tipo</TableHead>
            <TableHead className='hidden lg:table-cell'>Departamento</TableHead>
            <TableHead className={sortableHeaderClass} onClick={() => toggleSort('status')}>
              Estado {SortIcon('status', sortKey, sortDir)}
            </TableHead>
            <TableHead
              className={`hidden md:table-cell ${sortableHeaderClass}`}
              onClick={() => toggleSort('condition')}
            >
              Condición {SortIcon('condition', sortKey, sortDir)}
            </TableHead>
            <TableHead className='hidden lg:table-cell'>Ubicación</TableHead>
            <TableHead className='text-right'>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(item => (
            <TableRow
              key={item.id}
              className='cursor-pointer hover:bg-muted/50'
              onClick={() => router.push(`/inventory/equipment/${item.id}`)}
            >
              <TableCell className='font-medium'>{item.code}</TableCell>
              <TableCell>
                <div>
                  <div className='font-medium'>
                    {item.brand} {item.model}
                  </div>
                  <div className='text-sm text-muted-foreground'>S/N: {item.serialNumber}</div>
                </div>
              </TableCell>
              <TableCell className='hidden md:table-cell'>
                <Badge variant='outline'>{item.type?.name || 'Sin tipo'}</Badge>
              </TableCell>
              <TableCell className='hidden lg:table-cell'>
                {item.department ? (
                  <div>
                    <div className='text-sm font-medium'>{item.department.name}</div>
                    {item.department.family && (
                      <div className='text-xs text-muted-foreground'>
                        {item.department.family.name}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className='text-sm text-muted-foreground'>—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className={getAssetStatusColor(item.status)}>
                  {getAssetStatusLabel(item.status)}
                </Badge>
              </TableCell>
              <TableCell className='hidden md:table-cell'>
                <Badge className={CONDITION_COLORS[item.condition]}>
                  {CONDITION_LABELS[item.condition]}
                </Badge>
              </TableCell>
              <TableCell className='hidden lg:table-cell'>
                <span className='text-sm text-muted-foreground'>{item.location || '-'}</span>
              </TableCell>
              <TableCell className='text-right' onClick={e => e.stopPropagation()}>
                <div className='flex items-center justify-end gap-0.5'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-8 w-8 p-0 text-muted-foreground hover:text-foreground'
                    asChild
                  >
                    <Link
                      href={`/inventory/equipment/${item.id}`}
                      onClick={e => e.stopPropagation()}
                    >
                      <Eye className='h-4 w-4' />
                    </Link>
                  </Button>
                  {onViewQR && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0 text-muted-foreground hover:text-foreground'
                      onClick={() => onViewQR(item)}
                      title='Ver código QR'
                    >
                      <QrCode className='h-4 w-4' />
                    </Button>
                  )}
                  {canDelete && onDelete && item.status !== 'RETIRED' && (
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0 text-muted-foreground hover:text-destructive'
                      onClick={() => onDelete(item)}
                      title='Retirar equipo'
                    >
                      <Trash2 className='h-4 w-4' />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
