'use client'

/**
 * AdminFamilyAssignment — gestiona la asignación de administradores a una familia.
 * Solo el super administrador puede asignar/desasignar.
 * Espejo de TechnicianFamilyAssignment (by-family mode).
 */

import { useState } from 'react'
import { UserPlus, UserMinus, ShieldCheck, Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useFetch } from '@/hooks/common/use-fetch'

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

interface AdminOption {
  id: string
  name: string
  email: string
  isActive: boolean
  isSuperAdmin: boolean
}

export interface AssignedAdmin {
  id: string
  adminId: string
  familyId: string
  isActive: boolean
  admin: {
    id: string
    name: string
    email: string
    isSuperAdmin: boolean
  }
}

interface Props {
  familyId: string
  assignedAdmins: AssignedAdmin[]
  isSuperAdmin: boolean   // si el usuario actual es super admin
  onChanged: () => void
}

export function AdminFamilyAssignment({ familyId, assignedAdmins, isSuperAdmin, onChanged }: Props) {
  const { toast } = useToast()
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [unassigningId, setUnassigningId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const assignedIds = new Set(assignedAdmins.map((a) => a.adminId))

  // ✅ Migrado a useFetch — administradores activos (excluyendo super admins)
  const { data: allAdmins, loading: loadingUsers } = useFetch<AdminOption>(
    '/api/users',
    {
      params: { role: 'ADMIN', isActive: true, limit: 500 },
      transform: (d) => (d.data ?? []).filter((u: AdminOption) => !u.isSuperAdmin)
    }
  )

  const handleAssign = async (adminId: string) => {
    setAssigningId(adminId)
    try {
      const res = await fetch('/api/admin/family-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, familyId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.message || 'Error al asignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Administrador asignado a esta familia' })
      onChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally { setAssigningId(null) }
  }

  const handleUnassign = async (adminId: string) => {
    setUnassigningId(adminId)
    try {
      const res = await fetch(`/api/admin/family-assignments?adminId=${adminId}&familyId=${familyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Error', description: data.message || 'Error al desasignar', variant: 'destructive' })
        return
      }
      toast({ title: 'Administrador desasignado de esta familia' })
      onChanged()
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally { setUnassigningId(null) }
  }

  const unassignedUsers = allAdmins.filter(
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
          <ShieldCheck className="h-4 w-4" />
          Administradores Asignados
        </CardTitle>
        <CardDescription>
          Administradores con acceso restringido a esta familia.
          {!isSuperAdmin && (
            <span className="block mt-1 text-amber-600 dark:text-amber-400">
              Solo el administrador principal puede modificar estas asignaciones.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Asignados */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Asignados ({assignedAdmins.length})
          </p>
          {assignedAdmins.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-1">
              Ningún administrador restringido. Solo el administrador principal gestiona esta familia.
            </p>
          ) : (
            <div className="space-y-2">
              {assignedAdmins.map((a) => (
                <div
                  key={a.adminId}
                  className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{getInitials(a.admin.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium leading-none">{a.admin.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Familia</Badge>
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnassign(a.adminId)}
                        disabled={unassigningId === a.adminId}
                        className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        {unassigningId === a.adminId
                          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          : <UserMinus className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disponibles — solo visible para super admin */}
        {isSuperAdmin && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Disponibles para asignar
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar administrador..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            {loadingUsers ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Cargando administradores...
              </div>
            ) : unassignedUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground italic py-1">
                {search ? 'Sin resultados' : 'Todos los administradores ya están asignados'}
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
                      {assigningId === user.id
                        ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        : <UserPlus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
