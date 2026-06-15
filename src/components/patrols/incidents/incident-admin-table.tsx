'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export interface PatrolIncidentRow {
  id: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'RESOLVED' | 'ESCALATED'
  createdAt: string
  resolvedAt: string | null
  agent: { id: string; name: string }
  checkpoint: { id: string; name: string; location: string }
  patrol: {
    id: string
    scheduledStart: string
    familyId: string
    family?: { id: string; name: string } | null
    route: { id: string; name: string }
  }
  photos?: { id: string; path: string }[]
  resolvedBy?: { id: string; name: string } | null
  ticket?: { id: string; ticketCode: string; status: string } | null
}

interface IncidentAdminTableProps {
  incidents: PatrolIncidentRow[]
  loading: boolean
  pagination: {
    page: number
    limit: number
    total: number
    onPageChange: (p: number) => void
    onLimitChange: (l: number) => void
  }
  onRowClick: (incident: PatrolIncidentRow) => void
  onRefresh: () => void
  actions?: React.ReactNode
}

const SEVERITY_BADGE: Record<string, string> = {
  LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
}

const STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ESCALATED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
  ESCALATED: 'Escalada',
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…'
}

const columns: Column<PatrolIncidentRow>[] = [
  {
    key: 'createdAt',
    label: 'Fecha',
    sortable: true,
    render: item => format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm', { locale: es }),
  },
  {
    key: 'agent',
    label: 'Agente',
    sortable: true,
    render: item => item.agent.name,
  },
  {
    key: 'patrol',
    label: 'Ruta',
    render: item => item.patrol.route.name,
  },
  {
    key: 'checkpoint',
    label: 'Checkpoint',
    render: item => item.checkpoint.name,
  },
  {
    key: 'severity',
    label: 'Severidad',
    sortable: true,
    render: item => (
      <Badge className={`text-[10px] px-1.5 py-0 ${SEVERITY_BADGE[item.severity]}`}>
        {SEVERITY_LABELS[item.severity]}
      </Badge>
    ),
  },
  {
    key: 'status',
    label: 'Estado',
    sortable: true,
    render: item => (
      <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_BADGE[item.status]}`}>
        {STATUS_LABELS[item.status]}
      </Badge>
    ),
  },
  {
    key: 'description',
    label: 'Descripción',
    render: item => (
      <span className='text-muted-foreground' title={item.description}>
        {truncate(item.description, 50)}
      </span>
    ),
  },
]

export function IncidentAdminTable({
  incidents,
  loading,
  pagination,
  onRowClick,
  onRefresh,
  actions,
}: IncidentAdminTableProps) {
  return (
    <DataTable
      data={incidents}
      columns={columns}
      loading={loading}
      searchable={false}
      onRowClick={onRowClick}
      onRefresh={onRefresh}
      pagination={pagination}
      actions={actions}
      emptyState={{
        title: 'Sin novedades',
        description: 'No se encontraron novedades con los filtros aplicados',
      }}
    />
  )
}
