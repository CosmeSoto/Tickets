'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { GitBranch, RefreshCw } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type ProcessItem = {
  id: string
  code: string
  title: string
  status: string
  criticality: string
  level?: number
  updatedAt: string
  family: { name: string; color: string | null }
  department: { name: string } | null
  owner: { name: string }
  parentProcess?: { id: string; code: string; title: string; level: number } | null
  versions: { versionNumber: number }[]
  _count: { attachments: number }
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_AREA_REVIEW: 'Revisión de área',
  PENDING_EXTERNAL_DPD: 'Revisión externa',
  PUBLISHED: 'Publicado',
  REJECTED: 'Rechazado',
  OBSOLETE: 'Obsoleto',
}

export default function ProcessesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [processes, setProcesses] = useState<ProcessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProcesses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/processes')
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'No fue posible cargar los procesos.')
      }
      const data = await response.json()
      setProcesses(data.processes || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error al cargar los procesos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') void loadProcesses()
  }, [loadProcesses, status])

  const columns: Column<ProcessItem>[] = [
    {
      key: 'code',
      label: 'Código',
      sortable: true,
      render: item => <span className='font-mono text-xs text-muted-foreground'>{item.code}</span>,
    },
    {
      key: 'title',
      label: 'Proceso / procedimiento',
      sortable: true,
      render: item => (
        <div className='min-w-0'>
          <p className='font-medium truncate'>{item.title}</p>
          <p className='text-xs text-muted-foreground'>
            {item.family.name}
            {item.department ? ` · ${item.department.name}` : ''}
            {typeof item.level === 'number' ? ` · N${item.level}` : ''}
            {item.parentProcess ? ` · ${item.parentProcess.code}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: item => (
        <Badge variant={item.status === 'PUBLISHED' ? 'default' : 'secondary'}>
          {statusLabels[item.status] || item.status}
        </Badge>
      ),
    },
    {
      key: 'owner',
      label: 'Responsable',
      render: item => <span className='text-sm'>{item.owner.name}</span>,
    },
    {
      key: 'versions',
      label: 'Versión',
      render: item => <span className='text-sm'>v{item.versions[0]?.versionNumber ?? 1}</span>,
    },
    {
      key: 'updatedAt',
      label: 'Actualizado',
      sortable: true,
      render: item => (
        <span className='text-sm text-muted-foreground'>
          {new Date(item.updatedAt).toLocaleDateString('es-EC')}
        </span>
      ),
    },
  ]

  return (
    <ModuleLayout
      title='Procesos y procedimientos'
      subtitle='Consulta los procedimientos vigentes y su trazabilidad de versiones.'
      loading={loading && processes.length === 0}
      error={error}
      onRetry={loadProcesses}
      headerActions={
        <Button size='sm' variant='outline' onClick={loadProcesses} disabled={loading}>
          <RefreshCw className='mr-2 h-4 w-4' />
          Actualizar
        </Button>
      }
    >
      <DataTable
        title={`${processes.length} proceso${processes.length === 1 ? '' : 's'}`}
        description='El catálogo muestra únicamente los procedimientos publicados para tu alcance.'
        data={processes}
        columns={columns}
        loading={loading}
        onRefresh={loadProcesses}
        onRowClick={item => router.push(`/processes/${item.id}`)}
        emptyState={{
          icon: <GitBranch className='mx-auto mb-3 h-10 w-10 text-muted-foreground' />,
          title: 'No hay procesos disponibles',
          description: 'Aún no se han publicado procesos para las áreas a las que tienes acceso.',
        }}
      />
    </ModuleLayout>
  )
}
