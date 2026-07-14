'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  UserPlus,
  UserMinus,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import type { Contract } from '@/types/contracts'

interface AssignmentRow {
  id: string
  isActive: boolean
  startDate: string
  actualEndDate?: string | null
  changeReason?: string | null
  client: { id: string; name: string; email: string }
  deliverer: { id: string; name: string }
  deliveryAct?: { id: string; folio: string; status: string; acceptanceToken?: string } | null
  returnAct?: { id: string; folio: string; status: string; acceptanceToken?: string } | null
}

interface Props {
  contract: Contract
  onUpdated?: () => void
  canManage?: boolean
}

const ACT_STATUS: Record<string, string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  EXPIRED: 'Expirada',
}

export function ContractAssignmentsPanel({ contract, onUpdated, canManage = true }: Props) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [active, setActive] = useState<AssignmentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [notes, setNotes] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')

  const familyId = contract.familyId

  const clientOptions = useMemo(
    () =>
      clients.map(c => ({
        value: c.id,
        label: `${c.name} (${c.email})`,
      })),
    [clients]
  )

  const load = useCallback(async () => {
    if (!contract.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${contract.id}/assignments`)
      if (res.ok) {
        const data = await res.json()
        setAssignments(data.assignments ?? [])
        setActive(data.active ?? null)
      }
    } finally {
      setLoading(false)
    }
  }, [contract.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!familyId) {
      setClients([])
      return
    }
    fetch(`/api/inventory/contracts/clients?familyId=${familyId}`)
      .then(r => (r.ok ? r.json() : { clients: [] }))
      .then(d => setClients(d.clients ?? []))
      .catch(() => setClients([]))
  }, [familyId])

  const handleAssign = async () => {
    if (!clientId) {
      toast({ title: 'Selecciona un cliente', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/contracts/${contract.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          changeReason: changeReason || undefined,
          notes: notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al asignar')

      toast({
        title: active ? 'Cliente actualizado' : 'Cliente asignado',
        description: json.acceptanceUrl
          ? 'Se generó el acta de entrega para firma del cliente.'
          : 'Asignación registrada.',
      })
      setAssignOpen(false)
      setClientId('')
      setChangeReason('')
      setNotes('')
      await load()
      onUpdated?.()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo asignar',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleReturn = async () => {
    if (!active) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/contract-assignments/${active.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          withdrawalReason: withdrawalReason || undefined,
          handoverNotes: notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al retirar')

      toast({
        title: 'Acta de retiro generada',
        description: 'El cliente debe aceptar el acta de retiro de la suscripción.',
      })
      setReturnOpen(false)
      setWithdrawalReason('')
      setNotes('')
      await load()
      onUpdated?.()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo retirar',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (!familyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Asignación al cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            Asigna un área al contrato para vincular un cliente y generar actas de entrega/retiro.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className='pb-3'>
          <div className='flex items-start justify-between gap-3'>
            <div>
              <CardTitle className='text-base'>Asignación al cliente</CardTitle>
              <p className='text-xs text-muted-foreground mt-1'>
                Custodia operativa del servicio. Cambio de cliente genera acta de retiro y nueva
                entrega con snapshot financiero y contractual.
              </p>
            </div>
            <div className='flex gap-2 shrink-0'>
              {canManage && active && (
                <Button type='button' size='sm' variant='outline' onClick={() => setReturnOpen(true)}>
                  <UserMinus className='h-3.5 w-3.5 mr-1' />
                  Retiro
                </Button>
              )}
              {canManage && (
                <Button type='button' size='sm' onClick={() => setAssignOpen(true)}>
                  <UserPlus className='h-3.5 w-3.5 mr-1' />
                  {active ? 'Cambiar cliente' : 'Asignar'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          {loading ? (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <RefreshCw className='h-4 w-4 animate-spin' />
              Cargando asignaciones...
            </div>
          ) : active ? (
            <div className='rounded-lg border p-3 space-y-2'>
              <div className='flex items-center justify-between gap-2'>
                <div>
                  <p className='text-sm font-medium'>{active.client.name}</p>
                  <p className='text-xs text-muted-foreground'>{active.client.email}</p>
                </div>
                <Badge variant='outline' className='text-green-700 border-green-200'>
                  Activa
                </Badge>
              </div>
              <p className='text-xs text-muted-foreground'>
                Desde {new Date(active.startDate).toLocaleDateString('es-CL')}
              </p>
              {active.deliveryAct && (
                <div className='flex items-center gap-2 text-xs'>
                  <span>Acta entrega {active.deliveryAct.folio}:</span>
                  <Badge variant='secondary'>
                    {ACT_STATUS[active.deliveryAct.status] ?? active.deliveryAct.status}
                  </Badge>
                  {active.deliveryAct.status === 'PENDING' && active.deliveryAct.acceptanceToken && (
                    <a
                      href={`/acts/${active.deliveryAct.id}/accept?token=${active.deliveryAct.acceptanceToken}`}
                      className='inline-flex items-center gap-1 text-primary hover:underline'
                    >
                      Ver acta <ExternalLink className='h-3 w-3' />
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className='flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-500/10 px-3 py-2 text-sm'>
              <AlertTriangle className='h-4 w-4 text-amber-600 shrink-0 mt-0.5' />
              <span>Sin cliente asignado. Las suscripciones sin custodio operativo generan riesgo de cobros huérfanos.</span>
            </div>
          )}

          {assignments.length > 1 && (
            <div className='space-y-2'>
              <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                Historial ({assignments.length})
              </p>
              <ul className='space-y-1.5 max-h-40 overflow-y-auto'>
                {assignments.map(a => (
                  <li
                    key={a.id}
                    className='flex items-center justify-between text-xs rounded border px-2 py-1.5'
                  >
                    <span className='truncate'>{a.client.name}</span>
                    <span className='text-muted-foreground shrink-0 ml-2'>
                      {a.isActive ? 'Activa' : new Date(a.startDate).toLocaleDateString('es-CL')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active ? 'Cambiar cliente' : 'Asignar cliente'}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='space-y-1'>
              <Label>Cliente del área</Label>
              <Combobox
                options={clientOptions}
                value={clientId}
                onValueChange={setClientId}
                placeholder='Seleccionar cliente...'
                searchPlaceholder='Buscar por nombre o email...'
              />
            </div>
            {active && (
              <div className='space-y-1'>
                <Label>Motivo del cambio</Label>
                <Input
                  value={changeReason}
                  onChange={e => setChangeReason(e.target.value)}
                  placeholder='Ej: Reasignación por cambio de proyecto'
                />
              </div>
            )}
            <div className='space-y-1'>
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder='Observaciones para el acta'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAssignOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={submitting}>
              {submitting && <RefreshCw className='h-4 w-4 mr-2 animate-spin' />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retiro de suscripción</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <p className='text-sm text-muted-foreground'>
              Se generará un acta de retiro con los datos financieros y contractuales vigentes para{' '}
              <strong>{active?.client.name}</strong>.
            </p>
            <div className='space-y-1'>
              <Label>Motivo del retiro</Label>
              <Input
                value={withdrawalReason}
                onChange={e => setWithdrawalReason(e.target.value)}
                placeholder='Ej: Fin de proyecto, baja de servicio'
              />
            </div>
            <div className='space-y-1'>
              <Label>Notas de entrega (opcional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setReturnOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleReturn} disabled={submitting}>
              {submitting && <RefreshCw className='h-4 w-4 mr-2 animate-spin' />}
              Generar acta de retiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
