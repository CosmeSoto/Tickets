'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Save, Loader2, ShieldCheck, Search, X, UserCheck, Layers } from 'lucide-react'
import { ManagerFamiliesPanel } from '@/components/inventory/manager-families-panel'

interface InventorySettings {
  manager_ids: string[]
  act_expiration_days: number
  low_stock_alert_enabled: boolean
  license_alert_enabled: boolean
  license_alert_days_first: number
  license_alert_days_second: number
}

interface UserOption {
  id: string
  name: string
  email: string
  role: string
}

interface FamilyOption {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  code: string
}

const ROLE_LABELS: Record<string, string> = {
  TECHNICIAN: 'Técnico',
  CLIENT: 'Usuario Final',
}

const ROLE_COLORS: Record<string, string> = {
  TECHNICIAN: 'bg-blue-100 text-blue-700',
  CLIENT: 'bg-gray-100 text-gray-600',
}

export default function InventorySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [search, setSearch] = useState('')
  const [settings, setSettings] = useState<InventorySettings>({
    manager_ids: [],
    act_expiration_days: 7,
    low_stock_alert_enabled: true,
    license_alert_enabled: true,
    license_alert_days_first: 30,
    license_alert_days_second: 7,
  })

  // Familias por gestor
  const [allFamilies, setAllFamilies] = useState<FamilyOption[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState<string>('')
  const [managerFamilyIds, setManagerFamilyIds] = useState<string[]>([])
  const [loadingManagerFamilies, setLoadingManagerFamilies] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') { router.push('/unauthorized'); return }
    if (status === 'authenticated') { loadSettings(); loadAllUsers(); loadAllFamilies() }
  }, [session, status, router])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/settings/inventory')
      if (res.ok) {
        const data = await res.json()
        setSettings(prev => ({ ...prev, ...data.settings }))
      }
    } finally {
      setLoading(false)
    }
  }

  const loadAllUsers = async () => {
    const res = await fetch('/api/users?limit=500&isActive=true')
    if (res.ok) {
      const data = await res.json()
      setAllUsers((data.data || []).filter((u: UserOption) => u.role !== 'ADMIN'))
    }
  }

  const loadAllFamilies = async () => {
    const res = await fetch('/api/inventory/families')
    if (res.ok) {
      const data = await res.json()
      setAllFamilies(data.families ?? data ?? [])
    }
  }

  const loadManagerFamilies = async (managerId: string) => {
    try {
      setLoadingManagerFamilies(true)
      const res = await fetch(`/api/inventory/managers/${managerId}/families`)
      if (res.ok) {
        const data = await res.json()
        const families: Array<{ id: string }> = data.families ?? data ?? []
        setManagerFamilyIds(families.map(f => f.id))
      }
    } finally {
      setLoadingManagerFamilies(false)
    }
  }

  const handleManagerSelect = (managerId: string) => {
    setSelectedManagerId(managerId)
    setManagerFamilyIds([])
    if (managerId) loadManagerFamilies(managerId)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: 'Configuración guardada', description: 'Los cambios se han aplicado correctamente' })
      } else {
        throw new Error()
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar la configuración', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleManager = (userId: string) => {
    setSettings(prev => {
      const ids = prev.manager_ids || []
      return {
        ...prev,
        manager_ids: ids.includes(userId) ? ids.filter(id => id !== userId) : [...ids, userId],
      }
    })
  }

  const selectedManagers = useMemo(
    () => allUsers.filter(u => settings.manager_ids?.includes(u.id)),
    [allUsers, settings.manager_ids]
  )

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    return allUsers.filter(
      u => !settings.manager_ids?.includes(u.id) &&
        (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    )
  }, [allUsers, search, settings.manager_ids])

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title="Configuración de Inventario" subtitle="Ajustes del módulo de inventario">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout title="Configuración de Inventario" subtitle="Ajustes del módulo de inventario">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Gestores de Inventario */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Gestores de Inventario
            </CardTitle>
            <CardDescription>
              Usuarios con permiso para crear, editar y eliminar equipos. El administrador siempre tiene acceso. Sin gestores adicionales, nadie más podrá gestionar el inventario.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Gestores activos */}
            {selectedManagers.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <UserCheck className="h-4 w-4" />
                  <span>{selectedManagers.length} gestor{selectedManagers.length !== 1 ? 'es' : ''} asignado{selectedManagers.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="rounded-md border divide-y">
                  {selectedManagers.map(user => (
                    <div key={user.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                        <Badge variant="outline" className={`text-xs shrink-0 ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role] || user.role}
                        </Badge>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleManager(user.id)}
                        className="ml-3 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                        title="Quitar gestor"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Sin gestores adicionales — solo el administrador puede gestionar el inventario.
              </p>
            )}

            {/* Buscador + lista para agregar */}
            <div className="space-y-2">
              <Label className="text-sm">Agregar gestor</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o correo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[220px] overflow-y-auto rounded-md border divide-y">
                {filteredUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 text-center">
                    {search ? 'Sin resultados para esa búsqueda' : 'Todos los usuarios ya son gestores'}
                  </p>
                ) : (
                  filteredUsers.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => { toggleManager(user.id); setSearch('') }}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Badge variant="outline" className={`text-xs ml-3 shrink-0 ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actas de Entrega */}
        <Card>
          <CardHeader>
            <CardTitle>Actas de Entrega</CardTitle>
            <CardDescription>Configuración de actas de entrega y devolución</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="act-expiration">Días para expiración de actas</Label>
            <Input
              id="act-expiration"
              type="number"
              min="1"
              max="30"
              value={settings.act_expiration_days}
              onChange={(e) => setSettings({ ...settings, act_expiration_days: parseInt(e.target.value) || 7 })}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Días que el receptor tiene para aceptar un acta (1–30)
            </p>
          </CardContent>
        </Card>

        {/* Alertas de Consumibles */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Consumibles</CardTitle>
            <CardDescription>Notificar cuando el stock esté por debajo del mínimo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="low-stock-alert">Alertas de stock bajo</Label>
              <Switch
                id="low-stock-alert"
                checked={settings.low_stock_alert_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, low_stock_alert_enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Alertas de Licencias */}
        <Card>
          <CardHeader>
            <CardTitle>Alertas de Licencias</CardTitle>
            <CardDescription>Configura cuándo recibir alertas de vencimiento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="license-alert">Alertas de vencimiento</Label>
              <Switch
                id="license-alert"
                checked={settings.license_alert_enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, license_alert_enabled: checked })}
              />
            </div>

            {settings.license_alert_enabled && (
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="alert-first">Primera alerta (días antes)</Label>
                  <Input
                    id="alert-first"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.license_alert_days_first}
                    onChange={(e) => setSettings({ ...settings, license_alert_days_first: parseInt(e.target.value) || 30 })}
                    className="w-32"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alert-second">Segunda alerta (días antes)</Label>
                  <Input
                    id="alert-second"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.license_alert_days_second}
                    onChange={(e) => setSettings({ ...settings, license_alert_days_second: parseInt(e.target.value) || 7 })}
                    className="w-32"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Familias por Gestor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Familias por Gestor
            </CardTitle>
            <CardDescription>
              Asigna qué familias de inventario puede gestionar cada gestor. Selecciona un gestor para ver y editar sus familias asignadas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manager-select">Gestor</Label>
              <select
                id="manager-select"
                value={selectedManagerId}
                onChange={e => handleManagerSelect(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Selecciona un gestor...</option>
                {allUsers
                  .filter(u => settings.manager_ids?.includes(u.id))
                  .map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                  ))}
              </select>
              {settings.manager_ids?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  No hay gestores asignados. Agrega gestores en la sección de arriba primero.
                </p>
              )}
            </div>

            {selectedManagerId && (
              loadingManagerFamilies ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ManagerFamiliesPanel
                  key={selectedManagerId}
                  managerId={selectedManagerId}
                  allFamilies={allFamilies}
                  currentFamilyIds={managerFamilyIds}
                  onSaved={() => loadManagerFamilies(selectedManagerId)}
                />
              )
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />Guardar Cambios</>
            )}
          </Button>
        </div>
      </div>
    </RoleDashboardLayout>
  )
}
