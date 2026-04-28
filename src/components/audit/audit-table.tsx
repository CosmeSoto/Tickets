/**
 * Audit Table Component
 * Displays audit logs in a data table
 */

import { FileText, Activity, Clock } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import type { AuditLog, AuditPagination } from './utils/audit-types'
import { getAuditColumns } from './audit-table-columns'

interface AuditTableProps {
  logs: AuditLog[]
  loading: boolean
  pagination: AuditPagination
  onViewDetails: (log: AuditLog) => void
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
  onClearFilters: () => void
}

export function AuditTable({
  logs,
  loading,
  pagination,
  onViewDetails,
  onPageChange,
  onLimitChange,
  onClearFilters,
}: AuditTableProps) {
  const columns = getAuditColumns(onViewDetails)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Activity className='h-5 w-5' />
            Logs de Auditoría
          </div>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Clock className='h-4 w-4' />
            Mostrando {logs.length} de {pagination.total} registros
          </div>
        </CardTitle>
        <CardDescription>
          Registro detallado de todas las actividades del sistema con información contextual
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 && !loading ? (
          <div className='text-center py-12'>
            <FileText className='h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50' />
            <h3 className='text-lg font-semibold mb-2'>No hay logs de auditoría</h3>
            <p className='text-muted-foreground mb-4'>
              No se encontraron registros con los filtros aplicados
            </p>
            <Button variant='outline' onClick={onClearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <DataTable
            data={logs}
            columns={columns}
            loading={loading}
            searchable={false}
            pagination={{
              page: pagination.page,
              limit: pagination.limit,
              total: pagination.total,
              onPageChange,
              onLimitChange,
            }}
            emptyState={{
              icon: <FileText className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
              title: 'No hay logs de auditoría',
              description: 'No se encontraron registros con los filtros aplicados',
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
