'use client'

/**
 * ManagerFamilyAssignment — componente reutilizable para gestionar
 * la asignación de un gestor a familias, o de una familia a gestores.
 *
 * Soporta dos modos:
 *  - "by-manager": dado un gestor, muestra las familias disponibles
 *    con checkboxes para asignar/desasignar. Usado en InventoryManagerPanel.
 *  - "by-family": dado una familia, muestra los gestores disponibles
 *    y permite asignar/desasignar. Usado en tab-personal.tsx.
 */

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, UserMinus, Package, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

interface ManagerOption {
  id: string
  name: string
  email: string
  isActive: boolean
  canManageInventory?: boolean
}

export interface AssignedManager {
  id: string
  managerId: string
  familyId: string
  manager: {
    id: string
    name: string
    email: string
    role: string
    canManageInventory: boolean
    isActive: boolean
  }
}

// ── Mode props ────────────────────────────────────────────────────────────────

interface ByManagerProps {
  mode: 'by-manager'
  managerId: string
  managerName: string
  onChanged?: () => void
}

interface ByFamilyProps {
  mode: 'by-family'
  familyId: string
  assignedManagers: AssignedManager[]
  onChanged: () => void
}

type Props = ByManagerProps | ByFamilyProps

// ── Main ──────────────────────────────────────────────────────────────────────

export function ManagerFamilyAssignment(props: Props) {
  return props.mode === 'by-manager' ? (
    <ByManagerView {...props} />
  ) : (
    <ByFamilyView {...props} />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BY-MANAGER VIEW
// Shows families with checkboxes; assigns/unassigns the given manager.
// Uses PUT /api/inventory/managers/[managerId]/families for atomic updates.
// ─────────────────────────────────────────────────────────────────────────────

function ByManagerView({ managerId, managerName, onChanged }: ByManagerProps) {
  const { toast } = useToast()
  const [families, setFamilies] = useState<FamilyOption[]>([])
  const [assignedFamilyIds, setAssignedFamilyIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [familiesRes, assignedRes] = await Promise.all([
        fetch('/api/families?active=true').then((r) => r.json()),
        fetch(`/api/inventory/managers/${managerId}/families`).then((r) => r.json()),
      ])
      if (familiesRes.success) {
        setFamilies(familiesRes.data.filter((f: FamilyOption) => f.isActive))
      }
      if (assignedRes.families) {
        setAssignedFamilyIds(new Set(assignedRes.families.map((f: FamilyOption) => f.id)))
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [managerId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (family: FamilyOption, checked: boolean) => {
    const newIds = new Set(assignedFamilyIds)
    if (checked) {
      newIds.add(family.id)
    } else {
      newIds.delete(family.id)
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/managers/${managerId}/families`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyIds: Array.from(newIds) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al actualizar')
      setAssignedFamilyIds(newIds)
      toast({ title: checked ? `Asignado a "${family.name}"` : `Desasignado de "${family.name}"` })
      onChanged?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
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
          <Package className="h-4 w-4" />
          Familias de {managerName}
        </CardTitle>
        <CardDescription>Asigna o desasigna familias para este gestor</CardDescription>
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
              return (
                <div
                  key={family.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={assigned}
                      onCheckedChange={(v) => handleToggle(family, !!v)}
                      disabled={saving}
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
                    {assigned && (
                      <Badge variant="secondary" className="text-xs">Asignado</Badge>
                    )}
                    {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
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
// Shows managers split into assigned / available.
// ─────────────────────────────────────────────────────────────────────────────

function ByFamilyView({ familyId, assignedManagers, onChanged }: ByFamilyProps) {
  const { toast } = useToast()
  const [allManagers, setAllManagers] = useState<ManagerOption[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const assignedIds = new Set(assignedManagers.map((m) => m.managerId))

  const loadManagers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      // Todos los usuarios activos pueden ser gestores de inventario de una familia.
      // No filtramos por canManageInventory — ese flag se activa automáticamente
      // al asignar a una familia si el usuario no lo tiene aún.
      const res = await fetch('/api/users?isActive=true&limit=500')
      if (res.ok) {
        const data = await res.json()
        setAllManagers(data.data ?? [])
      }
    } catch {
      // silencioso
    } finally {
      setLoadingUsers(false)
    }
  }, [])

  useEffect(() => { loadManagers() }, [loadManagers])

  const handleAssign = async (userId: string) => {
    setAssigningId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/managers`, {
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
      toast({ title: 'Gestor asignado' })
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
      const res = await fetch(`/api/admin/families/${familyId}/managers/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Error al desasignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Gestor desasignado' })
      onChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setUnassigningId(null)
    }
  }

  const assignedUsers = allManagers.filter((u) => assignedIds.has(u.id))
  const unassignedUsers = allManagers.filter(
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
          <Package className="h-4 w-4" />
          Gestores de Inventario
        </CardTitle>
        <CardDescription>
          Usuarios con permiso de gestión de inventario asignados a esta familia
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Asignados ({assignedUsers.length})
          </p>
          {assignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-1">Ningún gestor asignado aún</p>
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
              Cargando gestores...
            </div>
          ) : unassignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-1">
              {search ? 'Sin resultados' : 'No hay gestores disponibles'}
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
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                      {(user as any).role === 'ADMIN' ? 'Admin' : (user as any).role === 'TECHNICIAN' ? 'Técnico' : 'Cliente'}
                    </Badge>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
