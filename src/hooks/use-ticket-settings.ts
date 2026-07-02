/**
 * Custom hook for Ticket Settings module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Family {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
  ticketFamilyConfig?: {
    ticketsEnabled: boolean
    isDefault: boolean
  } | null
}

export interface TicketFamilyConfig {
  id: string
  familyId: string
  ticketsEnabled: boolean
  codePrefix?: string | null
  isDefault: boolean
  autoAssignRespectsFamilies: boolean
  alertVolumeThreshold?: number | null
  businessHoursStart: string
  businessHoursEnd: string
  businessDays: string
}

export interface SlaRow {
  priority: string
  response: number
  resolution: number
}

export interface GlobalSettings {
  maxTicketsPerUser: number
  autoCloseDays: number
  autoAssignmentEnabled: boolean
  defaultFamilyId: string
}

// ── Constants ──────────────────────────────────────────────────────────────

export const DEFAULTS: SlaRow[] = [
  { priority: 'URGENT', response: 1, resolution: 4 },
  { priority: 'HIGH', response: 2, resolution: 8 },
  { priority: 'MEDIUM', response: 4, resolution: 24 },
  { priority: 'LOW', response: 8, resolution: 48 },
]

export const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const

export const PRIORITY_LABELS: Record<string, string> = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
}

export const DAY_OPTIONS = [
  { key: 'MON', label: 'L' },
  { key: 'TUE', label: 'M' },
  { key: 'WED', label: 'X' },
  { key: 'THU', label: 'J' },
  { key: 'FRI', label: 'V' },
  { key: 'SAT', label: 'S' },
  { key: 'SUN', label: 'D' },
]

// Dark mode compatible priority colors
export const PRIORITY_COLORS: Record<string, string> = {
  URGENT:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  HIGH: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  MEDIUM:
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useTicketSettings() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  // ── State ──
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [config, setConfig] = useState<TicketFamilyConfig | null>(null)
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [slaRows, setSlaRows] = useState<SlaRow[]>(DEFAULTS)
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    maxTicketsPerUser: 10,
    autoCloseDays: 3,
    autoAssignmentEnabled: true,
    defaultFamilyId: '',
  })

  async function parseSaveResponse(res: Response) {
    const data = await res.json().catch(() => ({}))
    const ok = res.ok && data.success !== false && !data.error
    return { ok, data }
  }

  // ── Load families ──
  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true)
    try {
      const res = await fetch('/api/families?includeInactive=true&module=tickets&configMode=true')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      toast({ title: 'Error', description: 'Error al cargar familias', variant: 'destructive' })
    } finally {
      setLoadingFamilies(false)
    }
  }, [toast])

  // ── Load family config ──
  const loadConfig = useCallback(
    async (familyId: string) => {
      setLoadingConfig(true)
      try {
        const res = await fetch(`/api/families/${familyId}/ticket-config`)
        const data = await res.json()
        setConfig(data.success ? data.data : null)
      } catch {
        toast({
          title: 'Error',
          description: 'Error al cargar configuración',
          variant: 'destructive',
        })
      } finally {
        setLoadingConfig(false)
      }
    },
    [toast]
  )

  // ── Load SLA policies ──
  const loadSLAPolicies = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/sla-policies?isActive=true')
      const data = await res.json()
      if (data.success) {
        const global = data.data.filter((p: any) => !p.categoryId)
        if (global.length > 0) {
          setSlaRows(
            PRIORITIES.map(priority => {
              const p = global.find((g: any) => g.priority === priority)
              const def = DEFAULTS.find(d => d.priority === priority)!
              return {
                priority,
                response: p?.responseTimeHours ?? def.response,
                resolution: p?.resolutionTimeHours ?? def.resolution,
              }
            })
          )
        }
      }
    } catch {
      /* keep defaults */
    }
  }, [])

  // ── Load global settings ──
  const loadGlobalSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setGlobalSettings(prev => ({
          ...prev,
          maxTicketsPerUser: data.maxTicketsPerUser ?? 10,
          autoCloseDays: data.autoCloseDays ?? 3,
          autoAssignmentEnabled: data.autoAssignmentEnabled ?? true,
        }))
      }
    } catch {
      /* keep defaults */
    }
  }, [])

  // ── Effects ──
  useEffect(() => {
    loadFamilies()
    loadSLAPolicies()
    loadGlobalSettings()
  }, [loadFamilies, loadSLAPolicies, loadGlobalSettings])

  useEffect(() => {
    const def = families.find(f => f.ticketFamilyConfig?.isDefault)
    if (def) setGlobalSettings(prev => ({ ...prev, defaultFamilyId: def.id }))
  }, [families])

  useEffect(() => {
    if (selectedFamilyId) loadConfig(selectedFamilyId)
  }, [selectedFamilyId, loadConfig])

  // ── Actions ──
  const handleSelectFamily = useCallback(
    (familyId: string) => {
      setSelectedFamilyId(familyId)
      router.replace(`/admin/settings/tickets?familyId=${familyId}`, { scroll: false })
    },
    [router]
  )

  const handleToggleTickets = useCallback(
    async (family: Family) => {
      if (!isSuperAdmin) {
        toast({
          title: 'Acción restringida',
          description: 'Solo el Super Administrador puede activar o desactivar tickets por área',
          variant: 'destructive',
        })
        return
      }
      try {
        const res = await fetch(`/api/families/${family.id}/ticket-config`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketsEnabled: !family.ticketFamilyConfig?.ticketsEnabled }),
        })
        const data = await res.json()
        if (data.success) {
          toast({ title: 'Éxito', description: data.message })
          window.dispatchEvent(new CustomEvent('modules-updated'))
          loadFamilies()
          if (selectedFamilyId === family.id) loadConfig(family.id)
        } else {
          toast({ title: 'Error', description: data.message, variant: 'destructive' })
        }
      } catch {
        toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
      }
    },
    [selectedFamilyId, loadFamilies, loadConfig, toast, isSuperAdmin]
  )

  const toggleDay = useCallback(
    (day: string) => {
      if (!config) return
      const days = config.businessDays ? config.businessDays.split(',').filter(Boolean) : []
      const next = days.includes(day) ? days.filter(d => d !== day) : [...days, day]
      const ordered = DAY_OPTIONS.map(d => d.key).filter(k => next.includes(k))
      setConfig({ ...config, businessDays: ordered.join(',') })
    },
    [config]
  )

  const handleSaveArea = useCallback(async () => {
    if (!config || !selectedFamilyId) {
      toast({
        title: 'Sin cambios',
        description: 'Selecciona un área para guardar',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/families/${selectedFamilyId}/ticket-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isSuperAdmin ? { ticketsEnabled: config.ticketsEnabled } : {}),
          codePrefix: config.codePrefix,
          autoAssignRespectsFamilies: config.autoAssignRespectsFamilies,
          alertVolumeThreshold: config.alertVolumeThreshold,
          businessHoursStart: config.businessHoursStart,
          businessHoursEnd: config.businessHoursEnd,
          businessDays: config.businessDays,
        }),
      })
      const { ok, data } = await parseSaveResponse(res)
      if (ok) {
        await loadConfig(selectedFamilyId)
        await loadFamilies()
        toast({
          title: 'Guardado',
          description: 'Configuración del área actualizada correctamente',
        })
        window.dispatchEvent(new CustomEvent('settings-updated'))
      } else {
        toast({
          title: 'Error',
          description: data.message || data.error || 'Error al guardar configuración del área',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [config, selectedFamilyId, loadConfig, loadFamilies, toast, isSuperAdmin])

  const handleSaveGlobal = useCallback(async () => {
    if (!isSuperAdmin) {
      toast({
        title: 'Acción restringida',
        description: 'Solo el Super Administrador puede modificar las reglas generales',
        variant: 'destructive',
      })
      return
    }
    setSavingGlobal(true)
    try {
      const requests: Promise<{ ok: boolean; data: Record<string, unknown> }>[] = [
        fetch('/api/admin/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            maxTicketsPerUser: globalSettings.maxTicketsPerUser,
            autoCloseDays: globalSettings.autoCloseDays,
            autoAssignmentEnabled: globalSettings.autoAssignmentEnabled,
          }),
        }).then(parseSaveResponse),
      ]

      if (globalSettings.defaultFamilyId) {
        requests.push(
          fetch(`/api/families/${globalSettings.defaultFamilyId}/ticket-config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isDefault: true }),
          }).then(parseSaveResponse)
        )
      }

      const results = await Promise.all(requests)
      if (results.every(r => r.ok)) {
        await loadGlobalSettings()
        await loadFamilies()
        toast({ title: 'Guardado', description: 'Reglas generales actualizadas' })
        window.dispatchEvent(new CustomEvent('settings-updated'))
      } else {
        const failed = results.find(r => !r.ok)
        toast({
          title: 'Error',
          description:
            (failed?.data.message as string) ||
            (failed?.data.error as string) ||
            'No se pudieron guardar las reglas generales',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSavingGlobal(false)
    }
  }, [globalSettings, loadGlobalSettings, loadFamilies, toast, isSuperAdmin])

  const handleReload = useCallback(async () => {
    await loadFamilies()
    await loadGlobalSettings()
    await loadSLAPolicies()
    if (selectedFamilyId) await loadConfig(selectedFamilyId)
  }, [loadFamilies, loadGlobalSettings, loadSLAPolicies, loadConfig, selectedFamilyId])

  const setGlobal = useCallback(
    <K extends keyof GlobalSettings>(key: K, value: GlobalSettings[K]) => {
      setGlobalSettings(prev => ({ ...prev, [key]: value }))
    },
    []
  )

  // ── Computed ──
  const selectedFamily = families.find(f => f.id === selectedFamilyId)
  const activeDays = config?.businessDays ? config.businessDays.split(',') : []

  return {
    // Session
    isSuperAdmin,

    // Data
    families,
    selectedFamilyId,
    selectedFamily,
    config,
    setConfig,
    slaRows,
    globalSettings,
    activeDays,

    // State
    loadingFamilies,
    loadingConfig,
    saving,
    savingGlobal,

    // Actions
    loadFamilies,
    loadGlobalSettings,
    handleReload,
    handleSelectFamily,
    handleToggleTickets,
    toggleDay,
    handleSaveArea,
    handleSaveGlobal,
    setGlobal,
  }
}
