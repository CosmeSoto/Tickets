'use client'

/**
 * TabPersonal — Pestaña Personal de la página de detalle de familia
 * Gestiona técnicos de tickets y gestores de inventario de forma independiente.
 * Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9
 */

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, UserMinus, Users, Package, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'

// ---- Types ----

export interface TechnicianAssignment {
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

export interface ManagerAssignment {
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

interface UserOption {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  canManageInventory?: boolean
}

export interface TabPersonalProps {
  familyId: string
  technicians: TechnicianAssignment[]
  managers: ManagerAssignment[]
  onPersonnelChanged: () => void
}

// ---- Helpers ----

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

// ---- PersonnelSection ----

interface PersonnelSectionProps {
  title: string
  description: string
  icon: React.ReactNode
  allUsers: UserOption[]
  assignedIds: Set<string>
  loadingUsers: boolean
  onAssign: (userId: string) => Promise<void>
  onUnassign: (userId: string) => Promise<void>
  assigningId: string | null
  unassigningId: string | null
}

function PersonnelSection({
  title,
  description,
  icon,
  allUsers,
  assignedIds,
  loadingUsers,
  onAssign,
  onUnassign,
  assigningId,
  unassigningId,
}: PersonnelSectionProps) {
  const [search, setSearch] = useState('')

  const assignedUsers = allUsers.filter((u) => assignedIds.has(u.id))
  const unassignedUsers = allUsers.filter(
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
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assigned users */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Asignados ({assignedUsers.length})
          </p>
          {assignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              Ningún usuario asignado aún
            </p>
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
                    <Badge variant="secondary" className="text-xs">
                      Asignado
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onUnassign(user.id)}
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

        {/* Search + available users */}
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
              Cargando usuarios...
            </div>
          ) : unassignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              {search ? 'Sin resultados para la búsqueda' : 'No hay usuarios disponibles'}
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
                    onClick={() => onAssign(user.id)}
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

// ---- TabPersonal ----

export function TabPersonal({
  familyId,
  technicians,
  managers,
  onPersonnelChanged,
}: TabPersonalProps) {
  const { toast } = useToast()

  // All technician users (role === 'TECHNICIAN')
  const [allTechnicians, setAllTechnicians] = useState<UserOption[]>([])
  const [loadingTechnicians, setLoadingTechnicians] = useState(true)

  // All inventory manager users (canManageInventory === true)
  const [allManagers, setAllManagers] = useState<UserOption[]>([])
  const [loadingManagers, setLoadingManagers] = useState(true)

  // Action states
  const [assigningTechId, setAssigningTechId] = useState<string | null>(null)
  const [unassigningTechId, setUnassigningTechId] = useState<string | null>(null)
  const [assigningMgrId, setAssigningMgrId] = useState<string | null>(null)
  const [unassigningMgrId, setUnassigningMgrId] = useState<string | null>(null)

  // Derived sets of assigned IDs
  const assignedTechIds = new Set(technicians.map((t) => t.technicianId))
  const assignedMgrIds = new Set(managers.map((m) => m.managerId))

  // ---- Load users ----

  const loadTechnicians = useCallback(async () => {
    setLoadingTechnicians(true)
    try {
      const res = await fetch('/api/users?role=TECHNICIAN&isActive=true&limit=500')
      if (res.ok) {
        const data = await res.json()
        setAllTechnicians(data.data ?? [])
      }
    } catch {
      // silencioso
    } finally {
      setLoadingTechnicians(false)
    }
  }, [])

  const loadManagers = useCallback(async () => {
    setLoadingManagers(true)
    try {
      // Fetch all active users and filter by canManageInventory client-side
      const res = await fetch('/api/users?isActive=true&limit=500')
      if (res.ok) {
        const data = await res.json()
        const users: UserOption[] = data.data ?? []
        setAllManagers(users.filter((u) => u.canManageInventory === true))
      }
    } catch {
      // silencioso
    } finally {
      setLoadingManagers(false)
    }
  }, [])

  useEffect(() => {
    loadTechnicians()
    loadManagers()
  }, [loadTechnicians, loadManagers])

  // ---- Technician actions ----

  const handleAssignTechnician = async (userId: string) => {
    setAssigningTechId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/technicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast({
          title: 'Ya asignado',
          description: data.error || 'El técnico ya está asignado a esta familia',
          variant: 'destructive',
        })
        return
      }
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Error al asignar el técnico',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Técnico asignado', description: 'El técnico fue asignado correctamente' })
      onPersonnelChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setAssigningTechId(null)
    }
  }

  const handleUnassignTechnician = async (userId: string) => {
    setUnassigningTechId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/technicians/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({
          title: 'Error',
          description: data.error || 'Error al desasignar el técnico',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Técnico desasignado', description: 'El técnico fue desasignado correctamente' })
      onPersonnelChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setUnassigningTechId(null)
    }
  }

  // ---- Manager actions ----

  const handleAssignManager = async (userId: string) => {
    setAssigningMgrId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/managers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast({
          title: 'Ya asignado',
          description: data.error || 'El gestor ya está asignado a esta familia',
          variant: 'destructive',
        })
        return
      }
      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'Error al asignar el gestor',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Gestor asignado', description: 'El gestor fue asignado correctamente' })
      onPersonnelChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setAssigningMgrId(null)
    }
  }

  const handleUnassignManager = async (userId: string) => {
    setUnassigningMgrId(userId)
    try {
      const res = await fetch(`/api/admin/families/${familyId}/managers/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({
          title: 'Error',
          description: data.error || 'Error al desasignar el gestor',
          variant: 'destructive',
        })
        return
      }
      toast({ title: 'Gestor desasignado', description: 'El gestor fue desasignado correctamente' })
      onPersonnelChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setUnassigningMgrId(null)
    }
  }

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Section 1: Técnicos de Tickets — Req 5.1, 5.2, 5.4, 5.5, 5.8 */}
      <PersonnelSection
        title="Técnicos de Tickets"
        description="Usuarios con rol TÉCNICO asignados a esta familia para atender tickets"
        icon={<Users className="h-4 w-4" />}
        allUsers={allTechnicians}
        assignedIds={assignedTechIds}
        loadingUsers={loadingTechnicians}
        onAssign={handleAssignTechnician}
        onUnassign={handleUnassignTechnician}
        assigningId={assigningTechId}
        unassigningId={unassigningTechId}
      />

      {/* Section 2: Gestores de Inventario — Req 5.1, 5.3, 5.6, 5.7, 5.9 */}
      <PersonnelSection
        title="Gestores de Inventario"
        description="Usuarios con permiso de gestión de inventario asignados a esta familia"
        icon={<Package className="h-4 w-4" />}
        allUsers={allManagers}
        assignedIds={assignedMgrIds}
        loadingUsers={loadingManagers}
        onAssign={handleAssignManager}
        onUnassign={handleUnassignManager}
        assigningId={assigningMgrId}
        unassigningId={unassigningMgrId}
      />
    </div>
  )
}
