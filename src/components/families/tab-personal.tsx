'use client'

/**
 * TabPersonal — Pestaña Personal de la página de detalle de familia.
 * - Técnicos de Tickets: delegado a TechnicianFamilyAssignment (componente compartido)
 * - Gestores de Inventario: sección propia
 * Requisitos: 5.1–5.9
 */

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, UserMinus, Package, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import {
  TechnicianFamilyAssignment,
  type AssignedTechnician,
} from '@/components/families/technician-family-assignment'
import { TechnicianManagementPanel } from '@/components/families/technician-management-panel'

// ---- Types ----

export type { AssignedTechnician as TechnicianAssignment }

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
  technicians: AssignedTechnician[]
  managers: ManagerAssignment[]
  onPersonnelChanged: () => void
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// ---- TabPersonal ----

export function TabPersonal({ familyId, technicians, managers, onPersonnelChanged }: TabPersonalProps) {
  const { toast } = useToast()

  // Gestores de inventario
  const [allManagers, setAllManagers] = useState<UserOption[]>([])
  const [loadingManagers, setLoadingManagers] = useState(true)
  const [assigningMgrId, setAssigningMgrId] = useState<string | null>(null)
  const [unassigningMgrId, setUnassigningMgrId] = useState<string | null>(null)
  const [mgrSearch, setMgrSearch] = useState('')

  const assignedMgrIds = new Set(managers.map((m) => m.managerId))

  const loadManagers = useCallback(async () => {
    setLoadingManagers(true)
    try {
      const res = await fetch('/api/users?isActive=true&limit=500')
      if (res.ok) {
        const data = await res.json()
        setAllManagers((data.data ?? []).filter((u: UserOption) => u.canManageInventory === true))
      }
    } catch {
      // silencioso
    } finally {
      setLoadingManagers(false)
    }
  }, [])

  useEffect(() => { loadManagers() }, [loadManagers])

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
        toast({ title: 'Ya asignado', description: data.error, variant: 'destructive' })
        return
      }
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Error al asignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Gestor asignado' })
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
      const res = await fetch(`/api/admin/families/${familyId}/managers/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Error', description: data.error || 'Error al desasignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Gestor desasignado' })
      onPersonnelChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setUnassigningMgrId(null)
    }
  }

  const assignedManagers = allManagers.filter((u) => assignedMgrIds.has(u.id))
  const unassignedManagers = allManagers.filter(
    (u) =>
      !assignedMgrIds.has(u.id) &&
      (mgrSearch === '' ||
        u.name.toLowerCase().includes(mgrSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(mgrSearch.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Técnicos — componente compartido con /admin/technicians */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Técnicos de Tickets</p>
            <p className="text-xs text-muted-foreground">Asignación de técnicos a esta familia</p>
          </div>
          <TechnicianManagementPanel onChanged={onPersonnelChanged} />
        </div>
        <TechnicianFamilyAssignment
          mode="by-family"
          familyId={familyId}
          assignedTechnicians={technicians}
          onChanged={onPersonnelChanged}
        />
      </div>

      {/* Gestores de Inventario */}
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
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Asignados ({assignedManagers.length})
            </p>
            {assignedManagers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-1">Ningún gestor asignado aún</p>
            ) : (
              <div className="space-y-2">
                {assignedManagers.map((user) => (
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
                        onClick={() => handleUnassignManager(user.id)}
                        disabled={unassigningMgrId === user.id}
                        className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {unassigningMgrId === user.id ? (
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

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Disponibles para asignar
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre o email..."
                value={mgrSearch}
                onChange={(e) => setMgrSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {loadingManagers ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Cargando gestores...
              </div>
            ) : unassignedManagers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-1">
                {mgrSearch ? 'Sin resultados' : 'No hay gestores disponibles'}
              </p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {unassignedManagers.map((user) => (
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
                      onClick={() => handleAssignManager(user.id)}
                      disabled={assigningMgrId === user.id}
                      className="h-7 px-2"
                    >
                      {assigningMgrId === user.id ? (
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
    </div>
  )
}
