/**
 * Hook para la página de configuración del módulo de patrullas.
 * Sigue el mismo patrón que use-inventory-settings.ts.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PatrolFamily {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
  patrolsEnabled?: boolean
}

export interface PatrolFormState {
  patrolsEnabled: boolean
  qrWindowMinutes: number
  geofenceRadiusMeters: number
  photoRetentionDays: number
  photoCompressionQuality: number
  photoMaxWidthPx: number
  requirePhotoOnStart: boolean
  requirePhotoOnEnd: boolean
  offlineSyncToleranceMinutes: number
  alertCompletionThreshold: number
  gracePeriodMinutes: number
  reminderMinutesBefore: number
  patrolIncidentCategoryId: string | null
}

const DEFAULT_FORM: PatrolFormState = {
  patrolsEnabled: true,
  qrWindowMinutes: 5,
  geofenceRadiusMeters: 1,
  photoRetentionDays: 90,
  photoCompressionQuality: 0.82,
  photoMaxWidthPx: 1280,
  requirePhotoOnStart: false,
  requirePhotoOnEnd: false,
  offlineSyncToleranceMinutes: 30,
  alertCompletionThreshold: 80,
  gracePeriodMinutes: 5,
  reminderMinutesBefore: 5,
  patrolIncidentCategoryId: null,
}

function buildForm(cfg: Record<string, any> | null): PatrolFormState {
  if (!cfg) return { ...DEFAULT_FORM }
  return {
    patrolsEnabled: cfg.patrolsEnabled ?? DEFAULT_FORM.patrolsEnabled,
    qrWindowMinutes: cfg.qrWindowMinutes ?? DEFAULT_FORM.qrWindowMinutes,
    geofenceRadiusMeters: cfg.geofenceRadiusMeters ?? DEFAULT_FORM.geofenceRadiusMeters,
    photoRetentionDays: cfg.photoRetentionDays ?? DEFAULT_FORM.photoRetentionDays,
    photoCompressionQuality: cfg.photoCompressionQuality ?? DEFAULT_FORM.photoCompressionQuality,
    photoMaxWidthPx: cfg.photoMaxWidthPx ?? DEFAULT_FORM.photoMaxWidthPx,
    requirePhotoOnStart: cfg.requirePhotoOnStart ?? DEFAULT_FORM.requirePhotoOnStart,
    requirePhotoOnEnd: cfg.requirePhotoOnEnd ?? DEFAULT_FORM.requirePhotoOnEnd,
    offlineSyncToleranceMinutes:
      cfg.offlineSyncToleranceMinutes ?? DEFAULT_FORM.offlineSyncToleranceMinutes,
    alertCompletionThreshold: cfg.alertCompletionThreshold ?? DEFAULT_FORM.alertCompletionThreshold,
    gracePeriodMinutes: cfg.gracePeriodMinutes ?? DEFAULT_FORM.gracePeriodMinutes,
    reminderMinutesBefore: cfg.reminderMinutesBefore ?? DEFAULT_FORM.reminderMinutesBefore,
    patrolIncidentCategoryId: cfg.patrolIncidentCategoryId ?? null,
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function usePatrolSettings() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [families, setFamilies] = useState<PatrolFamily[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [form, setForm] = useState<PatrolFormState>(DEFAULT_FORM)
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── Cargar familias con estado patrolsEnabled ──────────────────────────────
  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true)
    try {
      const [familiesRes, configsRes] = await Promise.all([
        fetch('/api/families?includeInactive=false'),
        fetch('/api/patrols/family-config'),
      ])

      const familiesData = await familiesRes.json()
      // family-config solo está disponible para ADMIN — si falla (ej: TECHNICIAN), usar mapa vacío
      const configsData = configsRes.ok
        ? await configsRes.json()
        : { data: {} as Record<string, boolean> }

      if (familiesData.success) {
        const rawFamilies: PatrolFamily[] = familiesData.data
        const configMap: Record<string, boolean> = configsData.data ?? {}

        setFamilies(
          rawFamilies.map(f => ({
            ...f,
            patrolsEnabled: configMap[f.id] ?? true,
          }))
        )
      }
    } catch {
      toast({ title: 'Error', description: 'Error al cargar familias', variant: 'destructive' })
    } finally {
      setLoadingFamilies(false)
    }
  }, [toast])

  // ── Cargar config de la familia seleccionada ───────────────────────────────
  const loadConfig = useCallback(
    async (familyId: string) => {
      setLoadingConfig(true)
      try {
        const res = await fetch(`/api/patrols/family-config/${familyId}`)
        const data = await res.json()
        if (data.success) {
          setForm(buildForm(data.data))
        }
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

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])
  useEffect(() => {
    if (selectedFamilyId) loadConfig(selectedFamilyId)
  }, [selectedFamilyId, loadConfig])

  // ── Toggle patrolsEnabled para una familia (optimista) ─────────────────────
  const handleTogglePatrols = useCallback(
    async (family: PatrolFamily) => {
      const newValue = !(family.patrolsEnabled ?? true)
      // Actualización optimista
      setFamilies(prev =>
        prev.map(f => (f.id === family.id ? { ...f, patrolsEnabled: newValue } : f))
      )

      try {
        const res = await fetch(`/api/patrols/family-config/${family.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patrolsEnabled: newValue }),
        })
        const data = await res.json()
        if (!data.success) {
          // Revertir
          setFamilies(prev =>
            prev.map(f => (f.id === family.id ? { ...f, patrolsEnabled: !newValue } : f))
          )
          toast({
            title: 'Error',
            description: data.error || 'Error al actualizar',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Éxito',
            description: `Patrullas ${newValue ? 'habilitadas' : 'deshabilitadas'} para ${family.name}`,
          })
          window.dispatchEvent(new CustomEvent('modules-updated'))
          if (selectedFamilyId === family.id) loadConfig(family.id)
        }
      } catch {
        setFamilies(prev =>
          prev.map(f => (f.id === family.id ? { ...f, patrolsEnabled: !newValue } : f))
        )
        toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
      }
    },
    [selectedFamilyId, loadConfig, toast]
  )

  // ── Guardar configuración ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!selectedFamilyId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/patrols/family-config/${selectedFamilyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Guardado', description: 'Configuración de patrullas actualizada' })
      } else if (data.details) {
        toast({
          title: 'Error de validación',
          description: data.details.map((e: any) => e.message).join(', '),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Error al guardar',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [selectedFamilyId, form, toast])

  // ── Helpers de formulario ──────────────────────────────────────────────────
  const setField = useCallback(
    <K extends keyof PatrolFormState>(key: K, value: PatrolFormState[K]) => {
      setForm(prev => ({ ...prev, [key]: value }))
    },
    []
  )

  const handleSelectFamily = useCallback(
    (familyId: string) => {
      setSelectedFamilyId(familyId)
      router.replace(`/admin/settings/patrols?familyId=${familyId}`, { scroll: false })
    },
    [router]
  )

  const selectedFamily = families.find(f => f.id === selectedFamilyId)

  return {
    families,
    selectedFamilyId,
    selectedFamily,
    form,
    loadingFamilies,
    loadingConfig,
    saving,
    loadFamilies,
    handleSelectFamily,
    handleTogglePatrols,
    handleSave,
    setField,
  }
}
