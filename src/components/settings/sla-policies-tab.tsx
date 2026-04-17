'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Bell, Save, RefreshCw, Edit2, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SlaPolicy {
  id: string
  name: string
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
  responseTimeHours: number
  resolutionTimeHours: number
  businessHoursOnly: boolean
  isActive: boolean
  categoryId: string | null
  category?: { id: string; name: string } | null
}

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const

const PRIORITY_META: Record<string, { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' }> = {
  URGENT: { label: 'Urgente', variant: 'destructive' },
  HIGH: { label: 'Alta', variant: 'default' },
  MEDIUM: { label: 'Media', variant: 'secondary' },
  LOW: { label: 'Baja', variant: 'outline' },
}

// Default fallback values if no policies exist in DB
const DEFAULTS: Record<string, { response: number; resolution: number }> = {
  URGENT: { response: 1, resolution: 4 },
  HIGH: { response: 2, resolution: 8 },
  MEDIUM: { response: 4, resolution: 24 },
  LOW: { response: 8, resolution: 48 },
}

interface EditableRow {
  id: string
  response: number
  resolution: number
  businessHoursOnly: boolean
}

export function SLAPoliciesTab({ isSuperAdmin = false }: { isSuperAdmin?: boolean }) {
  const { toast } = useToast()
  const [policies, setPolicies] = useState<SlaPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  // Editable state: keyed by priority
  const [editRows, setEditRows] = useState<Record<string, EditableRow>>({})

  const loadPolicies = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/sla-policies?isActive=true')
      const data = await res.json()
      if (data.success) {
        // Only global policies (no categoryId) for the main table
        const global = (data.data as SlaPolicy[]).filter((p) => !p.categoryId)
        setPolicies(global)
        // Build edit rows
        const rows: Record<string, EditableRow> = {}
        for (const p of global) {
          rows[p.priority] = {
            id: p.id,
            response: p.responseTimeHours,
            resolution: p.resolutionTimeHours,
            businessHoursOnly: p.businessHoursOnly,
          }
        }
        // Fill missing priorities with defaults
        for (const priority of PRIORITIES) {
          if (!rows[priority]) {
            rows[priority] = { id: '', response: DEFAULTS[priority].response, resolution: DEFAULTS[priority].resolution, businessHoursOnly: false }
          }
        }
        setEditRows(rows)
      }
    } catch {
      toast({ title: 'Error', description: 'Error al cargar políticas SLA', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadPolicies()
  }, [loadPolicies])

  const handleSave = async () => {
    setSaving(true)
    try {
      const results = await Promise.allSettled(
        PRIORITIES.map((priority) => {
          const row = editRows[priority]
          if (!row?.id) return Promise.resolve({ success: true, skipped: true })
          return fetch(`/api/admin/sla/policies/${row.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              responseTimeHours: row.response,
              resolutionTimeHours: row.resolution,
              businessHoursOnly: row.businessHoursOnly,
            }),
          }).then((r) => r.json())
        })
      )

      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.success === false && !r.value?.skipped)
      )

      if (failed.length === 0) {
        toast({ title: 'Éxito', description: 'Políticas SLA actualizadas correctamente' })
        setEditing(false)
        loadPolicies()
      } else {
        toast({
          title: 'Advertencia',
          description: `${failed.length} política(s) no pudieron guardarse. Verifica que existan en la base de datos.`,
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error al guardar políticas SLA', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const updateRow = (priority: string, field: keyof EditableRow, value: number | boolean) => {
    setEditRows((prev) => ({
      ...prev,
      [priority]: { ...prev[priority], [field]: value },
    }))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-medium">Políticas SLA globales del sistema</p>
          <p>
            Estos tiempos aplican como referencia base para todos los módulos que usen SLA (tickets, rondas, etc.).
            Cada módulo puede tener políticas específicas por categoría que sobreescriben estos valores.
          </p>
        </div>
      </div>

      {/* Tabla de políticas globales */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Tiempos por prioridad
              </CardTitle>
              <CardDescription className="mt-1">
                Tiempos de respuesta y resolución en horas hábiles por nivel de prioridad
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadPolicies}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {isSuperAdmin && !editing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {isSuperAdmin && editing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(false)
                      loadPolicies()
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-spin' : ''}`} />
                    {saving ? 'Guardando...' : 'Guardar'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-center">Respuesta (h)</TableHead>
                <TableHead className="text-center">Resolución (h)</TableHead>
                <TableHead className="text-center">Solo horas hábiles</TableHead>
                <TableHead className="text-center">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PRIORITIES.map((priority) => {
                const row = editRows[priority]
                const policy = policies.find((p) => p.priority === priority)
                return (
                  <TableRow key={priority}>
                    <TableCell>
                      <Badge variant={PRIORITY_META[priority].variant}>
                        {PRIORITY_META[priority].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {editing && isSuperAdmin ? (
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          className="w-20 mx-auto text-center font-mono h-8"
                          value={row?.response ?? ''}
                          onChange={(e) => updateRow(priority, 'response', parseInt(e.target.value) || 1)}
                        />
                      ) : (
                        <span className="font-mono font-medium">{row?.response ?? DEFAULTS[priority].response}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {editing && isSuperAdmin ? (
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          className="w-20 mx-auto text-center font-mono h-8"
                          value={row?.resolution ?? ''}
                          onChange={(e) => updateRow(priority, 'resolution', parseInt(e.target.value) || 1)}
                        />
                      ) : (
                        <span className="font-mono font-medium">{row?.resolution ?? DEFAULTS[priority].resolution}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {editing && isSuperAdmin ? (
                        <div className="flex justify-center">
                          <Switch
                            checked={row?.businessHoursOnly ?? false}
                            onCheckedChange={(v) => updateRow(priority, 'businessHoursOnly', v)}
                          />
                        </div>
                      ) : (
                        <Badge variant={row?.businessHoursOnly ? 'default' : 'secondary'} className="text-xs">
                          {row?.businessHoursOnly ? 'Sí' : 'No'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {policy ? (
                        <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-200">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Sin política
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {!isSuperAdmin && (
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <Info className="h-3 w-3" />
              Solo el Super Admin puede modificar las políticas SLA.
            </p>
          )}

          {policies.length === 0 && (
            <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-800 dark:text-amber-300">
              ⚠️ No hay políticas SLA en la base de datos. Los valores mostrados son los predeterminados del sistema.
              {isSuperAdmin && ' Crea las políticas desde la API o el seed para poder editarlas aquí.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referencia de precedencia */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jerarquía de precedencia</CardTitle>
          <CardDescription>Cómo se determina qué política SLA aplica a cada ticket</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {[
              { level: '1', title: 'Política de categoría específica', desc: 'La más prioritaria. Si la categoría del ticket tiene una política SLA asignada, se usa esa.' },
              { level: '2', title: 'Política de familia / área', desc: 'Si no hay política de categoría, se usa la política asignada al área (familia) del ticket.' },
              { level: '3', title: 'Política global (esta tabla)', desc: 'Fallback final. Se aplica cuando no hay política más específica.' },
            ].map((item) => (
              <li key={item.level} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {item.level}
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
