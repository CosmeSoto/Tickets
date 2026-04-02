'use client'

/**
 * InventoryManagerPanel — Panel global de gestores de inventario.
 * Lista todos los usuarios con canManageInventory = true,
 * muestra sus familias asignadas y permite gestionar las asignaciones.
 *
 * Se abre como Dialog desde el Tab Personal de Familias.
 * La promoción/despromoción de gestores se hace desde /admin/users.
 */

import { useState, useEffect, useCallback } from 'react'
import { Package, RefreshCw, ExternalLink, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import { ManagerFamilyAssignment } from '@/components/families/manager-family-assignment'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Manager {
  id: string
  name: string
  email: string
  isActive: boolean
  canManageInventory: boolean
  assignedFamilies?: { id: string; name: string; code: string; color?: string | null }[]
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// ── Trigger button ────────────────────────────────────────────────────────────

interface InventoryManagerPanelProps {
  onChanged?: () => void
}

export function InventoryManagerPanel({ onChanged }: InventoryManagerPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <Package className="h-4 w-4" />
        Gestionar Gestores
      </Button>

      <InventoryManagerDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) onChanged?.()
        }}
      />
    </>
  )
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function InventoryManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const router = useRouter()
  const [managers, setManagers] = useState<Manager[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await fetch('/api/users?isActive=true&limit=500')
      if (res.ok) {
        const data = await res.json()
        const mgrs: Manager[] = (data.data ?? []).filter(
          (u: Manager) => u.canManageInventory === true
        )
        // Load assigned families for each manager
        const withFamilies = await Promise.all(
          mgrs.map(async (m) => {
            try {
              const r = await fetch(`/api/inventory/managers/${m.id}/families`)
              if (r.ok) {
                const d = await r.json()
                return { ...m, assignedFamilies: d.families ?? [] }
              }
            } catch {
              // silencioso
            }
            return { ...m, assignedFamilies: [] }
          })
        )
        setManagers(withFamilies)
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [open])

  useEffect(() => { load() }, [load])

  const filtered = managers.filter(
    (m) =>
      search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Gestores de Inventario
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>Usuarios con acceso de gestión de inventario y sus familias asignadas</span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs h-7"
                onClick={() => router.push('/admin/users')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Gestionar permisos en Usuarios
              </Button>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar gestor por nombre o email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{managers.length} gestor(es) activo(s)</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5"
                onClick={load}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            {/* Manager list */}
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground justify-center">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Cargando gestores...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  {search
                    ? 'Sin resultados para la búsqueda'
                    : 'No hay gestores de inventario activos'}
                </p>
                {!search && (
                  <p className="text-xs mt-1">
                    Activa el permiso "Puede gestionar inventario" en un usuario desde{' '}
                    <button
                      className="underline hover:text-foreground"
                      onClick={() => router.push('/admin/users')}
                    >
                      Usuarios
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((manager) => (
                  <Card
                    key={manager.id}
                    className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                      selectedManager?.id === manager.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() =>
                      setSelectedManager(
                        selectedManager?.id === manager.id ? null : manager
                      )
                    }
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs">
                              {getInitials(manager.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium leading-none">{manager.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{manager.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {(manager.assignedFamilies?.length ?? 0) > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-end max-w-48">
                              {manager.assignedFamilies!.slice(0, 3).map((f) => (
                                <Badge
                                  key={f.id}
                                  variant="outline"
                                  className="text-xs"
                                  style={f.color ? { borderColor: f.color, color: f.color } : {}}
                                >
                                  {f.code}
                                </Badge>
                              ))}
                              {(manager.assignedFamilies?.length ?? 0) > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{(manager.assignedFamilies?.length ?? 0) - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Sin familias</Badge>
                          )}
                        </div>
                      </div>

                      {/* Expanded assignment panel */}
                      {selectedManager?.id === manager.id && (
                        <div
                          className="mt-3 pt-3 border-t"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ManagerFamilyAssignment
                            mode="by-manager"
                            managerId={manager.id}
                            managerName={manager.name}
                            onChanged={load}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
