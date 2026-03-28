'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, Edit, Trash2, QrCode } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EquipmentStatus, EquipmentCondition } from '@prisma/client'
import type { Equipment } from '@/types/inventory/equipment'
import { formatDate } from '@/lib/utils'

interface EquipmentTableProps {
  equipment: Equipment[]
  userRole: string
  onEdit?: (equipment: Equipment) => void
  onDelete?: (equipment: Equipment) => void
  onViewQR?: (equipment: Equipment) => void
}

const STATUS_COLORS: Record<EquipmentStatus, string> = {
  AVAILABLE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  ASSIGNED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  MAINTENANCE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  DAMAGED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  RETIRED: 'bg-muted text-muted-foreground',
}

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  MAINTENANCE: 'Mantenimiento',
  DAMAGED: 'Dañado',
  RETIRED: 'Retirado',
}

const CONDITION_COLORS: Record<EquipmentCondition, string> = {
  NEW: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  LIKE_NEW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  GOOD: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  FAIR: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
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
  onEdit,
  onDelete,
  onViewQR,
}: EquipmentTableProps) {
  const router = useRouter()
  const canEdit = userRole === 'ADMIN' || userRole === 'TECHNICIAN'
  const canDelete = userRole === 'ADMIN'

  if (equipment.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No se encontraron equipos
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Condición</TableHead>
            <TableHead>Ubicación</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/inventory/equipment/${item.id}`)}
            >
              <TableCell className="font-medium">{item.code}</TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{item.brand} {item.model}</div>
                  <div className="text-sm text-muted-foreground">
                    S/N: {item.serialNumber}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {item.type?.name || 'Sin tipo'}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[item.status]}>
                  {STATUS_LABELS[item.status]}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={CONDITION_COLORS[item.condition]}>
                  {CONDITION_LABELS[item.condition]}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-sm text-muted-foreground">
                  {item.location || '-'}
                </span>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Abrir menú</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/inventory/equipment/${item.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver detalles
                      </Link>
                    </DropdownMenuItem>
                    {onViewQR && (
                      <DropdownMenuItem onClick={() => onViewQR(item)}>
                        <QrCode className="mr-2 h-4 w-4" />
                        Ver código QR
                      </DropdownMenuItem>
                    )}
                    {canDelete && onDelete && item.status !== 'RETIRED' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(item)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Retirar equipo
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
