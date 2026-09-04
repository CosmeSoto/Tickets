'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  AlertTriangle,
  RefreshCw,
  UserPlus,
  UserMinus,
  ExternalLink,
  KeyRound,
  Loader2,
  Undo2,
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
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'
import type { Contract } from '@/types/contracts'

// Este despliegue no usa clientes externos (portal) por ahora — apagado a pedido.
// Cambiar a `true` si en el futuro hace falta dar acceso de portal a un cliente externo
// desde el diálogo de responsable operativo.
const SHOW_EXTERNAL_CLIENT_ACCESS_LINK = false

interface SystemClientUser {
  id: string
  name: string
  email: string
  role: string
}

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
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const isSuperAdmin =
    (session?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin === true

  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [active, setActive] = useState<AssignmentRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const [returnOpen, setReturnOpen] = useState(false)
  const [undoOpen, setUndoOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [clientId, setClientId] = useState('')
  const [changeReason, setChangeReason] = useState('')
  const [notes, setNotes] = useState('')
  const [withdrawalReason, setWithdrawalReason] = useState('')

  // Dar acceso de cliente al área sin salir del panel de asignación —
  // ver /api/inventory/contracts/clients: el personal interno (Admin/Técnico)
  // del área ya aparece automáticamente; esto solo habilita Clientes externos
  // vía user_family_access(module='tickets', canConsume=true) en esta familia.
  const [grantOpen, setGrantOpen] = useState(false)
  const [systemClients, setSystemClients] = useState<SystemClientUser[] | null>(null)
  const [loadingSystemClients, setLoadingSystemClients] = useState(false)
  const [grantingId, setGrantingId] = useState<string | null>(null)

  const familyId = contract.familyId

  const loadClients = useCallback(async () => {
    if (!familyId) {
      setClients([])
      return
    }
    try {
      const r = await fetch(`/api/inventory/contracts/clients?familyId=${familyId}`)
      const d = r.ok ? await r.json() : { clients: [] }
      setClients(d.clients ?? [])
    } catch {
      setClients([])
    }
  }, [familyId])

  const clientsWithAccessIds = useMemo(() => new Set(clients.map(c => c.id)), [clients])

  const candidatesWithoutAccess = useMemo(
    () => (systemClients ?? []).filter(u => !clientsWithAccessIds.has(u.id)),
    [systemClients, clientsWithAccessIds]
  )

  const openGrantDialog = async () => {
    setGrantOpen(true)
    if (systemClients !== null) return
    setLoadingSystemClients(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = res.ok ? await res.json() : { users: [] }
      const onlyClients: SystemClientUser[] = (data.users ?? []).filter(
        (u: SystemClientUser) => u.role === 'CLIENT'
      )
      setSystemClients(onlyClients)
    } catch {
      setSystemClients([])
    } finally {
      setLoadingSystemClients(false)
    }
  }

  const handleGrantAccess = async (user: SystemClientUser) => {
    if (!familyId) return
    setGrantingId(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/family-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'tickets', familyId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? json.message ?? 'No se pudo dar acceso')

      toast({
        title: 'Acceso otorgado',
        description: `${user.name} ya puede ser asignado como cliente de este contrato.`,
      })
      await loadClients()
      setClientId(user.id)
      setGrantOpen(false)
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo dar acceso',
        variant: 'destructive',
      })
    } finally {
      setGrantingId(null)
    }
  }

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
    loadClients()
  }, [loadClients])

  const handleAssign = async () => {
    if (!clientId) {
      toast({ title: 'Selecciona un responsable', variant: 'destructive' })
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
        title: active ? 'Responsable actualizado' : 'Responsable asignado',
        description: json.acceptanceUrl
          ? 'Se generó el acta de entrega para firma del responsable.'
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

      toast(
        json.returnAct
          ? {
              title: 'Acta de retiro generada',
              description: 'El responsable debe aceptar el acta de retiro de la suscripción.',
            }
          : {
              title: 'Responsable retirado',
              description:
                'Esta área no exige acta de entrega/retiro — la asignación se cerró directamente.',
            }
      )
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

  const handleUndo = async () => {
    if (!active) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/inventory/contract-assignments/${active.id}/undo`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al deshacer')

      toast({
        title: 'Asignación deshecha',
        description: json.restoredPreviousAssignmentId
          ? 'Se eliminó la asignación y su acta pendiente; se restauró al responsable anterior.'
          : 'Se eliminó la asignación y su acta pendiente. El contrato quedó sin responsable.',
      })
      setUndoOpen(false)
      await load()
      onUpdated?.()
    } catch (err: unknown) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'No se pudo deshacer',
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
          <CardTitle className='text-base'>Responsable operativo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            Asigna un área al contrato para vincular un responsable y generar actas de
            entrega/retiro.
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
              <CardTitle className='text-base'>Responsable operativo</CardTitle>
              <p className='text-xs text-muted-foreground mt-1'>
                Quien da seguimiento día a día a esta suscripción — no es el custodio comercial de
                la sección 4 (relación con el proveedor), es a quien se le entrega y quien firma por
                el servicio. Cambiarlo cierra al responsable actual y, si el área lo exige, genera
                actas de retiro y de nueva entrega con el detalle financiero y contractual vigente.
              </p>
            </div>
            <div className='flex gap-2 shrink-0'>
              {canManage && isSuperAdmin && active?.deliveryAct?.status === 'PENDING' && (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400'
                  onClick={() => setUndoOpen(true)}
                  title='El responsable aún no firmó el acta de entrega — se puede deshacer sin generar acta de retiro'
                >
                  <Undo2 className='h-3.5 w-3.5 mr-1' />
                  Deshacer asignación
                </Button>
              )}
              {canManage && active && (
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => setReturnOpen(true)}
                >
                  <UserMinus className='h-3.5 w-3.5 mr-1' />
                  Retiro
                </Button>
              )}
              {canManage && (
                <Button type='button' size='sm' onClick={() => setAssignOpen(true)}>
                  <UserPlus className='h-3.5 w-3.5 mr-1' />
                  {active ? 'Cambiar responsable' : 'Asignar'}
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
                  {active.deliveryAct.status === 'PENDING' &&
                    active.deliveryAct.acceptanceToken && (
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
              <span>
                Sin responsable operativo asignado. Las suscripciones sin responsable operativo
                generan riesgo de cobros huérfanos.
              </span>
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
            <DialogTitle>{active ? 'Cambiar responsable' : 'Asignar responsable'}</DialogTitle>
          </DialogHeader>
          <div className='space-y-3 py-2'>
            <div className='space-y-1'>
              <Label>Responsable del área</Label>
              <Combobox
                options={clientOptions}
                value={clientId}
                onValueChange={setClientId}
                placeholder='Seleccionar responsable...'
                searchPlaceholder='Buscar por nombre o email...'
              />
              <p className='text-xs text-muted-foreground'>
                Incluye personal interno (Admin/Técnico) del área y clientes externos con acceso.
              </p>
              {/* Deshabilitado a pedido: por ahora no se usan clientes externos en este
                  despliegue. Cambiar a `isAdmin &&` si en el futuro hace falta dar acceso
                  de portal a un cliente externo desde aquí (el diálogo "Dar acceso" más
                  abajo sigue intacto, solo queda inalcanzable mientras el flag esté en false). */}
              {SHOW_EXTERNAL_CLIENT_ACCESS_LINK && isAdmin && (
                <button
                  type='button'
                  onClick={openGrantDialog}
                  className='text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1'
                >
                  <KeyRound className='h-3 w-3' />
                  ¿No aparece un cliente externo? Darle acceso a esta área
                </button>
              )}
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
              Se retira a <strong>{active?.client.name}</strong> como responsable operativo. Si el
              área exige acta, se generará una de retiro con los datos financieros y contractuales
              vigentes para que la firme; si no, la asignación se cierra directo.
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
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
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

      {/* Deshacer asignación — solo mientras el acta de entrega esté PENDING */}
      <AlertDialog open={undoOpen} onOpenChange={setUndoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deshacer esta asignación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la asignación de <strong>{active?.client.name}</strong> y su acta de
              entrega {active?.deliveryAct?.folio} (aún sin firmar) — no queda ningún registro de
              que existió.{' '}
              {assignments.some(a => !a.isActive) &&
                'Si esta asignación reemplazó a un responsable anterior, se lo restaura como activo. '}
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUndo}
              disabled={submitting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {submitting ? 'Deshaciendo…' : 'Deshacer asignación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dar acceso de cliente al área — sin salir de Contratos */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Dar acceso a cliente externo</DialogTitle>
            <DialogDescription>
              El personal interno (Admin/Técnico) del área ya está disponible automáticamente en la
              lista. Usa esto solo para habilitar a un Cliente externo que aún no tiene acceso a
              esta área.
            </DialogDescription>
          </DialogHeader>
          <Command shouldFilter={true} className='rounded-md border'>
            <CommandInput placeholder='Buscar por nombre o email...' />
            <CommandList className='max-h-64 overflow-y-auto'>
              {loadingSystemClients ? (
                <div className='flex items-center justify-center py-6 text-sm text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin mr-2' />
                  Cargando usuarios...
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <p className='py-3 text-center text-sm text-muted-foreground'>
                      {(systemClients ?? []).length === 0
                        ? 'No hay usuarios con rol Cliente en el sistema. Créalo primero en Admin → Usuarios.'
                        : 'Sin resultados. Todos los clientes del sistema ya tienen acceso a esta área.'}
                    </p>
                  </CommandEmpty>
                  <CommandGroup>
                    {candidatesWithoutAccess.map(u => (
                      <CommandItem
                        key={u.id}
                        value={`${u.name} ${u.email}`}
                        onSelect={() => handleGrantAccess(u)}
                        disabled={grantingId === u.id}
                      >
                        <div className='flex-1 min-w-0'>
                          <p className='truncate text-sm'>{u.name}</p>
                          <p className='truncate text-xs text-muted-foreground'>{u.email}</p>
                        </div>
                        {grantingId === u.id && (
                          <Loader2 className='h-3.5 w-3.5 animate-spin ml-2 shrink-0' />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
