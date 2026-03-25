'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Save, Loader2, Users, Zap, Clock } from 'lucide-react'

interface TicketSettings {
  maxTicketsPerUser: number
  autoAssignmentEnabled: boolean
  autoCloseDays: number
}

export default function TicketSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<TicketSettings>({
    maxTicketsPerUser: 10,
    autoAssignmentEnabled: true,
    autoCloseDays: 3,
  })

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session?.user?.role !== 'ADMIN') { router.push('/unauthorized'); return }
    if (status === 'authenticated') loadSettings()
  }, [session, status, router])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setSettings({
          maxTicketsPerUser: data.maxTicketsPerUser ?? 10,
          autoAssignmentEnabled: data.autoAssignmentEnabled ?? true,
          autoCloseDays: data.autoCloseDays ?? 3,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast({ title: 'Configuración guardada', description: 'Los cambios se han aplicado correctamente' })
        window.dispatchEvent(new CustomEvent('settings-updated'))
      } else {
        const err = await res.json()
        throw new Error(
          err.details
            ? err.details.map((d: any) => `${d.path?.join('.')}: ${d.message}`).join(' | ')
            : err.error || 'Error al guardar'
        )
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'No se pudo guardar la configuración', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <RoleDashboardLayout title="Configuración de Tickets" subtitle="Reglas y comportamiento del módulo de tickets">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout title="Configuración de Tickets" subtitle="Reglas y comportamiento del módulo de tickets">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Límites */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Límites por Usuario
            </CardTitle>
            <CardDescription>
              Controla cuántos tickets puede tener abiertos un usuario al mismo tiempo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="maxTickets">Máximo de tickets abiertos por usuario</Label>
            <Input
              id="maxTickets"
              type="number"
              min="1"
              max="100"
              value={settings.maxTicketsPerUser}
              onChange={e => setSettings({ ...settings, maxTicketsPerUser: parseInt(e.target.value) || 10 })}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              Un usuario no podrá crear más tickets si ya tiene {settings.maxTicketsPerUser} abiertos
            </p>
          </CardContent>
        </Card>

        {/* Asignación automática */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Asignación Automática
            </CardTitle>
            <CardDescription>
              Asigna tickets automáticamente al técnico más disponible según categoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="autoAssign">Asignación automática habilitada</Label>
                <p className="text-sm text-muted-foreground">
                  Los tickets nuevos se asignarán al técnico con menor carga de trabajo en esa categoría
                </p>
              </div>
              <Switch
                id="autoAssign"
                checked={settings.autoAssignmentEnabled}
                onCheckedChange={checked => setSettings({ ...settings, autoAssignmentEnabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Auto-cierre */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Auto-cierre de Tickets Resueltos
            </CardTitle>
            <CardDescription>
              Cierra automáticamente los tickets resueltos si el usuario no califica dentro del plazo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="autoClose">Días para calificar antes del cierre automático</Label>
            <Input
              id="autoClose"
              type="number"
              min="1"
              max="30"
              value={settings.autoCloseDays}
              onChange={e => setSettings({ ...settings, autoCloseDays: parseInt(e.target.value) || 3 })}
              className="w-32"
            />
            <p className="text-sm text-muted-foreground">
              {settings.autoCloseDays === 1
                ? 'El ticket se cerrará 1 día después de ser resuelto si no hay calificación'
                : `El ticket se cerrará ${settings.autoCloseDays} días después de ser resuelto si no hay calificación`}
            </p>
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
