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
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Save, Loader2, ShieldCheck, Search, X, ChevronDown, ChevronRight,
  Bell, FileText, Layers, UserPlus,
} from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface InventorySettings {
  manager_ids: string[]
  act_expiration_days: number
  low_stock_alert_enabled: boolean
  license_alert_enabled: boolean
  license_alert_days_first: number
  license_alert_days_second: number
  mro_expiry_alert_enabled: boolean
  mro_expiry_alert_days: number
  mro_expiry_alert_days_urgent: number
  warranty_alert_enabled: boolean
  warranty_alert_days: number
  contract_alert_days: number
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
  CLIENT: 'bg-muted text-muted-foreground',
}

// ── Subcomponente: familias de un gestor (inline, expandible) ──────────────
function ManagerRow({
  user,
  allFamilies,
  onRemove,
}: {
  user: UserOption
  allFamilies: FamilyOption[]
  onRemove: (id: string) => void
}) {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [familyIds, setFamilyIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadFamilies = async () => {
    if (loaded) return
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/managers/${user.id}/families`)
      if (res.ok) {
        const data = await res.json()
        const families: Array<{ id: string }> = data.families ?? data ?? []
        setFamilyIds(families.map(f => f.id))
        setLoaded(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const toggle = () => {
    if (!expanded) loadFamilies()
    setExpanded(v => !v)
  }

  const toggleFamily = (id: string) =>
    setFamilyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const saveFamilies = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/managers/${user.id}/families`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyIds }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Familias actualizadas', description: `Familias de ${user.name} guardadas.` })
    } catch {
      toast({ title: 'Error', description: 'No se pudieron guardar las familias', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-md border overflow-hidden">
      {/* Fila del gestor */}
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30">
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {expanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </button>
        <Badge variant="outline" className={`text-xs shrink-0 ${ROLE_COLORS[user.role]}`}>
          {ROLE_LABELS[user.role] || user.role}
        </Badge>
        <button
          type="button"
          onClick={() => onRemove(user.id)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive shrink-0"
          title="Quitar gestor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel de familias expandible */}
      {expanded && (
        <div className="px-4 py-3 border-t space-y-3 bg-background">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando familias...
            </div>
          ) : allFamilies.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No hay familias disponibles.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Selecciona las familias que este gestor puede administrar:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {allFamilies.map(family => (
                  <div
                    key={family.id}
                    className="flex items-center gap-2 rounded border px-2.5 py-1.5 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleFamily(family.id)}
                  >
                    <Checkbox
                      id={`${user.id}-fam-${family.id}`}
                      checked={familyIds.includes(family.id)}
                      onCheckedChange={() => toggleFamily(family.id)}
                      onClick={e => e.stopPropagation()}
                    />
                    <Label
                      htmlFor={`${user.id}-fam-${family.id}`}
                      className="cursor-pointer flex-1"
                      onClick={e => e.preventDefault()}
                    >
                      <FamilyBadge family={family} size="sm" />
                    </Label>
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" onClick={saveFamilies} disabled={saving}>
                  {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  Guardar familias
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────
export default function InventorySettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [allFamilies, setAllFamilies] = useState<FamilyOption[]>([])
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [settings, setSettings] = useState<InventorySettings>({
    manager_ids: [],
    act_expiration_days: 7,
    low_stock_alert_enabled: true,
    license_alert_enabled: true,
    license_alert_days_first: 30,
    license_alert_days_second: 7,
    mro_expiry_alert_enabled: true,
    mro_expiry_alert_days: 30,
    mro_expiry_alert_days_urgent: 7,
    warranty_alert_enabled: true,
    warranty_alert_days: 30,
    contract_alert_days: 30,
  })

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

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/settings/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: 'Configuración guardada', description: 'Los cambios se han aplicado correctamente.' })
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

        {/* ── 1. Gestores y sus familias (unificado) ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Gestores de Inventario
            </CardTitle>
            <CardDescription>
              Usuarios con permiso para gestionar el inventario. Expande cada gestor para asignarle las familias que puede administrar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Lista de gestores con familias inline */}
            {selectedManagers.length > 0 ? (
              <div className="space-y-2">
                {selectedManagers.map(user => (
                  <ManagerRow
                    key={user.id}
                    user={user}
                    allFamilies={allFamilies}
                    onRemove={toggleManager}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-dashed p-6 text-center">
                <Layers className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Sin gestores asignados. Solo el administrador puede gestionar el inventario.
                </p>
              </div>
            )}

            <Separator />

            {/* Agregar gestor */}
            {!showSearch ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSearch(true)}
                className="w-full"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Agregar gestor
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Buscar por nombre o correo..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowSearch(false); setSearch('') }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-h-[200px] overflow-y-auto rounded-md border divide-y">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      {search ? 'Sin resultados' : 'Todos los usuarios ya son gestores'}
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
            )}
          </CardContent>
        </Card>

        {/* ── 2. Alertas (agrupadas) ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alertas Automáticas
            </CardTitle>
            <CardDescription>
              Configura cuándo el sistema debe notificarte sobre stock bajo y vencimientos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Stock bajo */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Alertas de stock bajo</p>
                <p className="text-xs text-muted-foreground">Notificar cuando un consumible esté por debajo del mínimo</p>
              </div>
              <Switch
                checked={settings.low_stock_alert_enabled}
                onCheckedChange={checked => setSettings({ ...settings, low_stock_alert_enabled: checked })}
              />
            </div>

            <Separator />

            {/* Licencias y contratos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de vencimiento de licencias y contratos</p>
                  <p className="text-xs text-muted-foreground">Notificar antes de que expiren licencias o contratos</p>
                </div>
                <Switch
                  checked={settings.license_alert_enabled}
                  onCheckedChange={checked => setSettings({ ...settings, license_alert_enabled: checked })}
                />
              </div>

              {settings.license_alert_enabled && (
                <div className="grid grid-cols-2 gap-4 pl-1 pt-1 border-l-2 border-muted ml-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="alert-first" className="text-xs">Primera alerta (días antes)</Label>
                    <Input
                      id="alert-first"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.license_alert_days_first}
                      onChange={e => setSettings({ ...settings, license_alert_days_first: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 30 días antes</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="alert-second" className="text-xs">Segunda alerta (días antes)</Label>
                    <Input
                      id="alert-second"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.license_alert_days_second}
                      onChange={e => setSettings({ ...settings, license_alert_days_second: parseInt(e.target.value) || 7 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 7 días antes (urgente)</p>
                  </div>
                  <div className="space-y-1.5 col-span-2">
                    <Label htmlFor="contract-alert-days" className="text-xs">Días de anticipación para alertas de contratos</Label>
                    <Input
                      id="contract-alert-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.contract_alert_days}
                      onChange={e => setSettings({ ...settings, contract_alert_days: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Días antes del vencimiento para enviar alerta de contrato</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Alertas de Caducidad MRO */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de Caducidad MRO</p>
                  <p className="text-xs text-muted-foreground">Habilitar alertas de caducidad de materiales MRO</p>
                </div>
                <Switch
                  checked={settings.mro_expiry_alert_enabled}
                  onCheckedChange={checked => setSettings({ ...settings, mro_expiry_alert_enabled: checked })}
                />
              </div>

              {settings.mro_expiry_alert_enabled && (
                <div className="grid grid-cols-2 gap-4 pl-1 pt-1 border-l-2 border-muted ml-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="mro-alert-days" className="text-xs">Días para primera alerta</Label>
                    <Input
                      id="mro-alert-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.mro_expiry_alert_days}
                      onChange={e => setSettings({ ...settings, mro_expiry_alert_days: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 30 días antes de caducar</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mro-alert-days-urgent" className="text-xs">Días para alerta urgente</Label>
                    <Input
                      id="mro-alert-days-urgent"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.mro_expiry_alert_days_urgent}
                      onChange={e => setSettings({ ...settings, mro_expiry_alert_days_urgent: parseInt(e.target.value) || 7 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Ej: 7 días antes (urgente)</p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Alertas de Garantía de Equipos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Alertas de Garantía de Equipos</p>
                  <p className="text-xs text-muted-foreground">Habilitar alertas de vencimiento de garantía</p>
                </div>
                <Switch
                  checked={settings.warranty_alert_enabled}
                  onCheckedChange={checked => setSettings({ ...settings, warranty_alert_enabled: checked })}
                />
              </div>

              {settings.warranty_alert_enabled && (
                <div className="pl-1 pt-1 border-l-2 border-muted ml-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="warranty-alert-days" className="text-xs">Días de anticipación para alerta</Label>
                    <Input
                      id="warranty-alert-days"
                      type="number"
                      min="1"
                      max="365"
                      value={settings.warranty_alert_days}
                      onChange={e => setSettings({ ...settings, warranty_alert_days: parseInt(e.target.value) || 30 })}
                      className="w-28 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Días antes del vencimiento de garantía para notificar</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── 3. Actas de entrega ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Actas de Entrega
            </CardTitle>
            <CardDescription>
              Tiempo que tiene el receptor para aceptar un acta antes de que expire.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="space-y-1">
                <Label htmlFor="act-expiration" className="text-sm">Días para aceptar un acta</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="act-expiration"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.act_expiration_days}
                    onChange={e => setSettings({ ...settings, act_expiration_days: parseInt(e.target.value) || 7 })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">días</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Si el receptor no acepta en este plazo, el acta expira y la asignación se cancela.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Guardar */}
        <div className="flex justify-end pb-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
              : <><Save className="mr-2 h-4 w-4" />Guardar cambios</>}
          </Button>
        </div>

      </div>
    </RoleDashboardLayout>
  )
}
