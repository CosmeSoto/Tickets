import { Badge } from '@/components/ui/badge'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  AVAILABLE: { label: 'Disponible', variant: 'default' },
  ASSIGNED: { label: 'Asignado', variant: 'secondary' },
  MAINTENANCE: { label: 'Mantenimiento', variant: 'outline' },
  RETIRED: { label: 'Retirado', variant: 'destructive' },
  DAMAGED: { label: 'Dañado', variant: 'destructive' },
  FOR_SALE: { label: 'En venta', variant: 'outline' },
  SOLD: { label: 'Vendido', variant: 'secondary' },
}

interface EquipmentStatusBadgeProps {
  status: string
  className?: string
}

export function EquipmentStatusBadge({ status, className }: EquipmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, variant: 'outline' as BadgeVariant }
  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  )
}

/** Exporta el mapa de configuración para uso en tablas/filtros */
export { STATUS_CONFIG }
