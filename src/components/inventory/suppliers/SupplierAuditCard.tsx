'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type AuditRow = {
  id: string
  action: string
  actionLabel: string
  message: string | null
  creditLimit?: number | null
  paymentTermsDays?: number | null
  preferredPaymentMethod?: string | null
  bankAccountMasked?: string | null
  user?: { name?: string | null; email?: string | null } | null
  createdAt: string
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function actionVariant(action: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (action === 'DELETE' || action === 'DEACTIVATE') return 'destructive'
  if (action === 'REACTIVATE' || action === 'CREATE') return 'default'
  return 'secondary'
}

interface SupplierAuditCardProps {
  supplierId: string
}

export function SupplierAuditCard({ supplierId }: SupplierAuditCardProps) {
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/suppliers/${supplierId}/audit?limit=20`)
      if (!res.ok) throw new Error('No se pudo cargar la auditoría')
      const data = await res.json()
      setLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 gap-2'>
        <CardTitle className='text-base flex items-center gap-2'>
          <History className='h-4 w-4' />
          Historial de auditoría
        </CardTitle>
        <Button type='button' variant='ghost' size='icon' onClick={load} disabled={loading} title='Actualizar'>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading && logs.length === 0 ? (
          <p className='text-sm text-muted-foreground'>Cargando…</p>
        ) : error ? (
          <p className='text-sm text-destructive'>{error}</p>
        ) : logs.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Sin eventos registrados aún para este proveedor.
          </p>
        ) : (
          <ul className='space-y-3'>
            {logs.map(log => (
              <li key={log.id} className='rounded-md border p-3 space-y-1.5'>
                <div className='flex flex-wrap items-center gap-2 justify-between'>
                  <Badge variant={actionVariant(log.action)}>{log.actionLabel}</Badge>
                  <span className='text-[11px] text-muted-foreground'>{fmtWhen(log.createdAt)}</span>
                </div>
                <p className='text-sm leading-snug'>
                  {log.message || `${log.actionLabel} de proveedor`}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {log.user?.name || log.user?.email || 'Usuario desconocido'}
                  {(log.paymentTermsDays != null || log.creditLimit != null) && (
                    <>
                      {' · '}
                      {log.paymentTermsDays != null && `Plazo ${log.paymentTermsDays}d`}
                      {log.paymentTermsDays != null && log.creditLimit != null && ' · '}
                      {log.creditLimit != null && `Crédito ${Number(log.creditLimit).toLocaleString()}`}
                    </>
                  )}
                  {log.bankAccountMasked ? ` · Cta ${log.bankAccountMasked}` : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
