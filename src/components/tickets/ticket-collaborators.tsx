'use client'

/**
 * TicketCollaborators — gestiona los colaboradores de un ticket en el sidebar.
 * Muestra los técnicos colaboradores actuales y permite agregar/quitar.
 * Solo técnicos de la misma familia del ticket pueden ser colaboradores.
 */

import { useState, useEffect, useCallback } from 'react'
import { UserPlus, UserMinus, Users, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

interface Collaborator {
  id: string
  collaboratorId: string
  collaborator: {
    id: string
    name: string
    email: string
    role: string
    avatar?: string | null
  }
  addedBy: { id: string; name: string }
}

interface TechnicianOption {
  id: string
  name: string
  email: string
}

interface Props {
  ticketId: string
  familyId?: string | null
  assigneeId?: string
  canManage: boolean
}

export function TicketCollaborators({ ticketId, familyId, assigneeId, canManage }: Props) {
  const { toast } = useToast()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [availableTechs, setAvailableTechs] = useState<TechnicianOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [addingId, setAddingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const loadCollaborators = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/collaborators`)
      if (res.ok) {
        const data = await res.json()
        setCollaborators(data.data ?? [])
      }
    } catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [ticketId])

  const loadAvailableTechs = useCallback(async () => {
    try {
      // Si hay familia, cargar técnicos de esa familia; si no, todos los técnicos activos
      const url = familyId
        ? `/api/users?role=TECHNICIAN&isActive=true&familyId=${familyId}&limit=500`
        : `/api/users?role=TECHNICIAN&isActive=true&limit=500`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setAvailableTechs(data.data ?? [])
      }
    } catch { /* silencioso */ }
  }, [familyId])

  useEffect(() => { loadCollaborators() }, [loadCollaborators])

  useEffect(() => {
    if (showAdd) loadAvailableTechs()
  }, [showAdd, loadAvailableTechs])

  const handleAdd = async (techId: string) => {
    setAddingId(techId)
    try {
      const res = await fetch(`/api/tickets/${ticketId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collaboratorId: techId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Error', description: data.message || 'No se pudo agregar', variant: 'destructive' })
        return
      }
      toast({ title: 'Colaborador agregado' })
      await loadCollaborators()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally { setAddingId(null) }
  }

  const handleRemove = async (collaboratorId: string) => {
    setRemovingId(collaboratorId)
    try {
      const res = await fetch(
        `/api/tickets/${ticketId}/collaborators?collaboratorId=${collaboratorId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Error', description: data.message || 'No se pudo quitar', variant: 'destructive' })
        return
      }
      toast({ title: 'Colaborador eliminado' })
      await loadCollaborators()
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally { setRemovingId(null) }
  }

  const collaboratorIds = new Set(collaborators.map((c) => c.collaboratorId))

  const filteredTechs = availableTechs.filter(
    (t) =>
      t.id !== assigneeId &&
      !collaboratorIds.has(t.id) &&
      (search === '' ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.email.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex-1">
        <p className="text-sm font-medium">Colaboradores</p>
        <p className="text-xs text-muted-foreground mt-1">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Colaboradores</p>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => { setShowAdd(!showAdd); setSearch('') }}
          >
            {showAdd ? 'Cerrar' : (
              <>
                <UserPlus className="h-3 w-3 mr-1" />
                Agregar
              </>
            )}
          </Button>
        )}
      </div>

      {/* Lista de colaboradores actuales */}
      {collaborators.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin colaboradores</p>
      ) : (
        <div className="space-y-1.5">
          {collaborators.map((c) => (
            <div key={c.collaboratorId} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src={c.collaborator.avatar ?? undefined} />
                  <AvatarFallback className="text-[10px]">{getInitials(c.collaborator.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{c.collaborator.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{c.collaborator.email}</p>
                </div>
              </div>
              {canManage && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(c.collaboratorId)}
                  disabled={removingId === c.collaboratorId}
                >
                  {removingId === c.collaboratorId
                    ? <RefreshCw className="h-3 w-3 animate-spin" />
                    : <UserMinus className="h-3 w-3" />}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Panel para agregar colaboradores */}
      {showAdd && canManage && (
        <div className="border rounded-md p-2 space-y-2 bg-muted/20">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Buscar técnico..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-6 h-7 text-xs"
            />
          </div>
          {filteredTechs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-1 text-center">
              {search ? 'Sin resultados' : 'No hay técnicos disponibles'}
            </p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredTechs.map((tech) => (
                <div key={tech.id} className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-muted/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      <AvatarFallback className="text-[9px]">{getInitials(tech.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{tech.name}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs flex-shrink-0"
                    onClick={() => handleAdd(tech.id)}
                    disabled={addingId === tech.id}
                  >
                    {addingId === tech.id
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : <UserPlus className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
