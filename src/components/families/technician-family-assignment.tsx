'use client'

/**
 * TechnicianFamilyAssignment — componente reutilizable para gestionar
 * la asignación de un técnico a familias, o de una familia a técnicos.
 *
 * Soporta dos modos:
 *  - "by-technician": dado un técnico, muestra las familias disponibles
 *    y permite asignar/desasignar. Usado en /admin/technicians.
 *  - "by-family": dado una familia, muestra los técnicos disponibles
 *    y permite asignar/desasignar. Usado en /admin/families/[id] > Tab Personal.
 */

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, UserMinus, Layers, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isActive: boolean
}

interface TechnicianOption {
  id: string
  name: string
  email: string
  isActive: boolean
}

// ── Mode: by-technician ───────────────────────────────────────────────────────
// Shows families; lets you assign/unassign the given technician to each family.

interface ByTechnicianProps {
  mode: 'by-technician'
  technicianId: string
  technicianName: string
  /** Called after any successful assignment change */
  onChanged?: () => void
}

// ── Mode: by-family ───────────────────────────────────────────────────────────
// Shows technicians; lets you assign/unassign each to the given family.

interface ByFamilyProps {
  mode: 'by-family'
  familyId: string
  /** Pre-loaded list of already-assigned technicians (from unified GET) */
  assignedTechnicians: AssignedTechnician[]
  /** Called after any successful assignment change so parent can reload */
  onChanged: () => void
}

export interface AssignedTechnician {
  id: string
  technicianId: string
  familyId: string
  isActive: boolean
  technician: {
    id: string
    name: string
    email: string
    role: string
    isActive: boolean
  }
}

type Props = ByTechnicianProps | ByFamilyProps

// ── Main component ────────────────────────────────────────────────────────────

export function TechnicianFamilyAssignment(props: Props) {
  return props.mode === 'by-technician' ? (
    <ByTechnicianView {...props} />
  ) : (
    <ByFamilyView {...props} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BY-TECHNICIAN VIEW
// Shows a list of families with checkboxes; assigns/unassigns the technician.
// ─────────────────────────────────────────────────────────────────────────────

function ByTechnicianView({ technicianId, technicianName, onChanged }: ByTechnicianProps) {
  const { toast } = useToast()
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [assignedFamilyIds, setAssignedFamilyIds] = useState<Set<string>>(new Set())
  const [assignmentIds, setAssignmentIds] = useState<Record<string, string>>({}) // familyId → assignmentId
  const [activeTicketsByFamily, setActiveTicketsByFamily] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [familiesRes, assignmentsRes] = await Promise.all([
        fetch('/api/families?active=true').then((r) => r.json()),
        fetch(`/api/technician-family-assignments?technicianId=${technicianId}`).then((r) => r.json()),
      ])
      if (familiesRes.success) {
        setFamilies(familiesRes.data.filter((f: FamilyOption) => f.isActive))
      }
      if (assignmentsRes.success) {
        const ids = new Set<string>()
        const aIds: Record<string, string> = {}
        const ticketMap: Record<string, number> = {}
        for (const a of assignmentsRes.data ?? []) {
          if (a.isActive !== false) {
            ids.add(a.familyId)
            aIds[a.familyId] = a.id
            ticketMap[a.familyId] = a.activeTickets ?? 0
          }
        }
        setAssignedFamilyIds(ids)
        setAssignmentIds(aIds)
        setActiveTicketsByFamily(ticketMap)
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [technicianId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (family: FamilyOption, checked: boolean) => {
    const activeTickets = activeTicketsByFamily[family.id] ?? 0
    if (!checked && activeTickets > 0) {
      const confirmed = window.confirm(
        `El técnico tiene ${activeTickets} ticket(s) activo(s) en "${family.name}". ¿Desasignar de todas formas?`
      )
      if (!confirmed) return
    }

    setSavingId(family.id)
    try {
      if (checked) {
        const res = await fetch('/api/technician-family-assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ technicianId, familyId: family.id }),
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Error al asignar')
        toast({ title: `Asignado a "${family.name}"` })
      } else {
        const assignmentId = assignmentIds[family.id]
        if (!assignmentId) return
        const res = await fetch(`/api/technician-family-assignments/${assignmentId}?confirm=true`, {
          method: 'DELETE',
        })
        const data = await res.json()
        if (!res.ok || !data.success) throw new Error(data.message || 'Error al desasignar')
        toast({ title: `Desasignado de "${family.name}"` })
      }
      await load()
      onChanged?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setSavingId(null)
    }
  }

  const filtered = families.filter(
    (f) =>
      search === '' ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Familias de {technicianName}
        </CardTitle>
        <CardDescription>Asigna o desasigna familias para este técnico</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar familia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground justify-center">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Cargando familias...
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            {search ? 'Sin resultados' : 'No hay familias activas'}
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filtered.map((family) => {
              const assigned = assignedFamilyIds.has(family.id)
              const activeTickets = activeTicketsByFamily[family.id] ?? 0
              const isSaving = savingId === family.id
              return (
                <div
                  key={family.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={assigned}
                      onCheckedChange={(v) => handleToggle(family, !!v)}
                      disabled={isSaving}
                    />
                    {family.color && (
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: family.color }}
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium leading-none">{family.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">{family.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {assigned && activeTickets > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {activeTickets} activos
                      </Badge>
                    )}
                    {isSaving && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BY-FAMILY VIEW
// Shows a list of technicians split into assigned / available.
// ─────────────────────────────────────────────────────────────────────────────

function ByFamilyView({ familyId, assignedTechnicians, onChanged }: ByFamilyProps) {
  const { toast } = useToast()
  const [allTechnicians, setAllTechnicians] = useState<TechnicianOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const assignedIds = new Set(assignedTechnicians.map((t) => t.technicianId))

  const loadTechnicians = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const res = await fetch('/api/users?role=TECHNICIAN&isActive=true&limit=500')
      if (res.ok) {
        const data = await res.json()
        setAllTechnicians(data.data ?? [])
      }
    } catch {
      // silencioso
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { loadTechnicians() }, [loadTechnicians])

  const handleAssign = async (userId: string) => {
    setAssigningId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/technicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast({ title: 'Ya asignado', description: data.error, variant: 'destructive' })
        return
      }
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Error al asignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Técnico asignado' })
      onChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setAssigningId(null)
    }
  }

  const handleUnassign = async (userId: string) => {
    setUnassigningId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/technicians/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Error al desasignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Técnico desasignado' })
      onChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setUnassigningId(null)
    }
  }

  const assignedUsers = allTechnicians.filter((u) => assignedIds.has(u.id))
  const unassignedUsers = allTechnicians.filter(
    (u) =>
      !assignedIds.has(u.id) &&
      (search === '' ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers className="h-4 w-4" />
          Técnicos de Tickets
        </CardTitle>
        <CardDescription>
          Usuarios con rol TÉCNICO asignados a esta familia para atender tickets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Asignados ({assignedUsers.length})
          </p>
          {assignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-1">Ningún técnico asignado aún</p>
          ) : (
            <div className="space-y-2">
              {assignedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Asignado</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnassign(user.id)}
                      disabled={unassigningId === user.id}
                      className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {unassigningId === user.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserMinus className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Disponibles para asignar
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          {loadingUsers ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Cargando técnicos...
            </div>
          ) : unassignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-1">
              {search ? 'Sin resultados' : 'No hay técnicos disponibles'}
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {unassignedUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{user.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAssign(user.id)}
                    disabled={assigningId === user.id}
                    className="h-7 px-2"
                  >
                    {assigningId === user.id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
