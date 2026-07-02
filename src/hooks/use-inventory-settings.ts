/**
 * Custom hook for Inventory Settings module
 * Centralizes all business logic and state management
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import {
  DEFAULT_FAMILY_CONFIG,
  DEFAULT_MODE_CONFIG,
  normalizeSectionsByMode,
} from '@/lib/inventory/family-config-types'
import { normalizeDepreciationMethod } from '@/lib/inventory/depreciation'
import type {
  AssetSubtype,
  FormSection,
  AcquisitionMode,
  ModeSectionConfig,
} from '@/lib/inventory/family-config-types'

// ── Types ──────────────────────────────────────────────────────────────────

export interface Family {
  id: string
  code: string
  name: string
  color?: string | null
  icon?: string | null
  isActive: boolean
  inventoryEnabled?: boolean
}

export interface RawConfig {
  familyId: string
  allowedSubtypes?: string[]
  visibleSections?: string[]
  requiredSections?: string[]
  requireFinancialForNew?: boolean
  sectionsByMode?: Record<string, unknown> | null
  defaultDepreciationMethod?: string | null
  defaultUsefulLifeYears?: number | null
  defaultResidualValuePct?: number | null
  codePrefix?: string | null
  autoApproveDecommission?: boolean
  requireDeliveryAct?: boolean
  inventoryEnabled?: boolean
}

export interface FormState {
  inventoryEnabled: boolean
  assetRequestsEnabled: boolean
  allowedSubtypes: AssetSubtype[]
  visibleSections: FormSection[]
  requiredSections: FormSection[]
  requireFinancialForNew: boolean
  sectionsByMode: Partial<Record<AcquisitionMode, ModeSectionConfig>>
  defaultDepreciationMethod: string | null
  defaultUsefulLifeYears: string
  defaultResidualValuePct: string
  codePrefix: string
  autoApproveDecommission: boolean
  requireDeliveryAct: boolean
}

export interface GlobalRules {
  actExpirationDays: number
  lowStockAlertEnabled: boolean
  licenseAlertEnabled: boolean
  licenseAlertDaysFirst: number
  licenseAlertDaysSecond: number
  warrantyAlertEnabled: boolean
  warrantyAlertDays: number
  contractAlertDays: number
}

const DEFAULT_GLOBAL_RULES: GlobalRules = {
  actExpirationDays: 7,
  lowStockAlertEnabled: true,
  licenseAlertEnabled: true,
  licenseAlertDaysFirst: 30,
  licenseAlertDaysSecond: 7,
  warrantyAlertEnabled: true,
  warrantyAlertDays: 30,
  contractAlertDays: 30,
}

/** Normaliza alias legacy del método de depreciación al enum de Prisma. */
function apiSettingsToGlobalRules(settings: Record<string, unknown>): GlobalRules {
  return {
    actExpirationDays:
      Number(settings.act_expiration_days) || DEFAULT_GLOBAL_RULES.actExpirationDays,
    lowStockAlertEnabled:
      settings.low_stock_alert_enabled !== undefined
        ? settings.low_stock_alert_enabled === true
        : DEFAULT_GLOBAL_RULES.lowStockAlertEnabled,
    licenseAlertEnabled:
      settings.license_alert_enabled !== undefined
        ? settings.license_alert_enabled === true
        : DEFAULT_GLOBAL_RULES.licenseAlertEnabled,
    licenseAlertDaysFirst:
      Number(settings.license_alert_days_first) || DEFAULT_GLOBAL_RULES.licenseAlertDaysFirst,
    licenseAlertDaysSecond:
      Number(settings.license_alert_days_second) || DEFAULT_GLOBAL_RULES.licenseAlertDaysSecond,
    warrantyAlertEnabled:
      settings.warranty_alert_enabled !== undefined
        ? settings.warranty_alert_enabled === true
        : DEFAULT_GLOBAL_RULES.warrantyAlertEnabled,
    warrantyAlertDays:
      Number(settings.warranty_alert_days) || DEFAULT_GLOBAL_RULES.warrantyAlertDays,
    contractAlertDays:
      Number(settings.contract_alert_days) || DEFAULT_GLOBAL_RULES.contractAlertDays,
  }
}

function globalRulesToApiPayload(rules: GlobalRules): Record<string, number | boolean> {
  return {
    act_expiration_days: rules.actExpirationDays,
    low_stock_alert_enabled: rules.lowStockAlertEnabled,
    license_alert_enabled: rules.licenseAlertEnabled,
    license_alert_days_first: rules.licenseAlertDaysFirst,
    license_alert_days_second: rules.licenseAlertDaysSecond,
    warranty_alert_enabled: rules.warrantyAlertEnabled,
    warranty_alert_days: rules.warrantyAlertDays,
    contract_alert_days: rules.contractAlertDays,
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────

function buildForm(cfg: RawConfig | null, assetRequestsEnabled = false): FormState {
  const sectionsByMode: Partial<Record<AcquisitionMode, ModeSectionConfig>> = {}
  const normalizedByMode = normalizeSectionsByMode(
    cfg?.sectionsByMode as Parameters<typeof normalizeSectionsByMode>[0]
  )
  if (normalizedByMode) {
    for (const mode of ['FIXED_ASSET', 'RENTAL', 'LOAN'] as AcquisitionMode[]) {
      const modeConfig = normalizedByMode[mode]
      if (modeConfig) sectionsByMode[mode] = modeConfig
    }
  }
  return {
    inventoryEnabled: cfg?.inventoryEnabled ?? true,
    assetRequestsEnabled,
    allowedSubtypes:
      (cfg?.allowedSubtypes as AssetSubtype[]) ?? DEFAULT_FAMILY_CONFIG.allowedSubtypes,
    visibleSections:
      (cfg?.visibleSections as FormSection[]) ?? DEFAULT_FAMILY_CONFIG.visibleSections,
    requiredSections:
      (cfg?.requiredSections as FormSection[]) ?? DEFAULT_FAMILY_CONFIG.requiredSections,
    requireFinancialForNew: cfg?.requireFinancialForNew ?? true,
    sectionsByMode,
    defaultDepreciationMethod: normalizeDepreciationMethod(cfg?.defaultDepreciationMethod),
    defaultUsefulLifeYears:
      cfg?.defaultUsefulLifeYears != null ? String(cfg.defaultUsefulLifeYears) : '',
    defaultResidualValuePct:
      cfg?.defaultResidualValuePct != null ? String(cfg.defaultResidualValuePct) : '',
    codePrefix: cfg?.codePrefix ?? '',
    autoApproveDecommission: cfg?.autoApproveDecommission ?? false,
    requireDeliveryAct: cfg?.requireDeliveryAct ?? true,
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useInventorySettings() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true

  // ── State ──
  const [families, setFamilies] = useState<Family[]>([])
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(
    searchParams.get('familyId')
  )
  const [form, setForm] = useState<FormState>(buildForm(null))
  const [loadingFamilies, setLoadingFamilies] = useState(true)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving] = useState(false)
  const [residualError, setResidualError] = useState<string | null>(null)
  const [activeModeTab, setActiveModeTab] = useState<AcquisitionMode>('FIXED_ASSET')
  const [useModeConfig, setUseModeConfig] = useState(false)

  const [globalRules, setGlobalRules] = useState<GlobalRules>(DEFAULT_GLOBAL_RULES)
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [loadingGlobal, setLoadingGlobal] = useState(false)

  // ── Load families ──
  const loadFamilies = useCallback(async () => {
    setLoadingFamilies(true)
    try {
      const [familiesRes, configsRes] = await Promise.all([
        fetch('/api/families?includeInactive=true&module=inventory&configMode=true'),
        fetch('/api/inventory/family-config'),
      ])
      const familiesData = await familiesRes.json()
      const configsData = configsRes.ok ? await configsRes.json() : { data: {} }

      if (familiesData.success) {
        const configMap: Record<string, boolean> = configsData.data ?? {}
        setFamilies(
          familiesData.data.map((f: Family) => ({
            ...f,
            inventoryEnabled: configMap[f.id] ?? true,
          }))
        )
      }
    } catch {
      toast({ title: 'Error', description: 'Error al cargar familias', variant: 'destructive' })
    } finally {
      setLoadingFamilies(false)
    }
  }, [toast])

  // ── Load config for selected family ──
  const loadConfig = useCallback(
    async (familyId: string) => {
      setLoadingConfig(true)
      try {
        const [configRes, assetRequestsRes] = await Promise.all([
          fetch(`/api/inventory/family-config/${familyId}`),
          fetch(`/api/inventory/asset-requests/family-config/${familyId}`),
        ])
        const data = await configRes.json()
        const assetRequestsData = assetRequestsRes.ok ? await assetRequestsRes.json() : null

        if (data.success) {
          setForm(buildForm(data.data, assetRequestsData?.assetRequestsEnabled === true))
          const modeConfig = normalizeSectionsByMode(data.data?.sectionsByMode)
          setUseModeConfig(!!modeConfig && Object.keys(modeConfig).length > 0)
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

  // ── Load global settings ──
  const loadGlobalRules = useCallback(async () => {
    setLoadingGlobal(true)
    try {
      const res = await fetch('/api/settings/inventory')
      if (res.ok) {
        const data = await res.json()
        if (data?.settings) setGlobalRules(apiSettingsToGlobalRules(data.settings))
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Error al cargar reglas generales',
        variant: 'destructive',
      })
    } finally {
      setLoadingGlobal(false)
    }
  }, [toast])

  useEffect(() => {
    loadGlobalRules()
  }, [loadGlobalRules])

  useEffect(() => {
    loadFamilies()
  }, [])

  useEffect(() => {
    if (selectedFamilyId) loadConfig(selectedFamilyId)
  }, [selectedFamilyId])

  // ── Toggle inventory for a family ──
  const handleToggleInventory = useCallback(
    async (family: Family) => {
      if (!isSuperAdmin) {
        toast({
          title: 'Acción restringida',
          description: 'Solo el Super Administrador puede activar o desactivar inventario por área',
          variant: 'destructive',
        })
        return
      }
      const newValue = !(family.inventoryEnabled ?? true)
      setFamilies(prev =>
        prev.map(f => (f.id === family.id ? { ...f, inventoryEnabled: newValue } : f))
      )
      try {
        const res = await fetch(`/api/inventory/family-config/${family.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventoryEnabled: newValue }),
        })
        const data = await res.json()
        if (!data.success) {
          setFamilies(prev =>
            prev.map(f => (f.id === family.id ? { ...f, inventoryEnabled: !newValue } : f))
          )
          toast({
            title: 'Error',
            description: data.error || 'Error al actualizar',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Éxito',
            description: `Inventario ${newValue ? 'habilitado' : 'deshabilitado'} para ${family.name}`,
          })
          window.dispatchEvent(new CustomEvent('modules-updated'))
          if (selectedFamilyId === family.id) loadConfig(family.id)
        }
      } catch {
        setFamilies(prev =>
          prev.map(f => (f.id === family.id ? { ...f, inventoryEnabled: !newValue } : f))
        )
        toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
      }
    },
    [selectedFamilyId, loadConfig, toast, isSuperAdmin]
  )

  // ── Save family config ──
  const handleSave = useCallback(async () => {
    if (!selectedFamilyId || residualError) return
    setSaving(true)
    try {
      const payload = {
        allowedSubtypes: form.allowedSubtypes,
        visibleSections: form.visibleSections,
        requiredSections: form.requiredSections,
        requireFinancialForNew: form.requireFinancialForNew,
        sectionsByMode: useModeConfig ? form.sectionsByMode : null,
        defaultDepreciationMethod: normalizeDepreciationMethod(form.defaultDepreciationMethod),
        defaultUsefulLifeYears: form.defaultUsefulLifeYears
          ? parseFloat(form.defaultUsefulLifeYears)
          : null,
        defaultResidualValuePct: form.defaultResidualValuePct
          ? parseFloat(form.defaultResidualValuePct)
          : null,
        codePrefix: form.codePrefix || null,
        autoApproveDecommission: form.autoApproveDecommission,
        requireDeliveryAct: form.requireDeliveryAct,
      }

      const requests: Promise<Response>[] = [
        fetch(`/api/inventory/family-config/${selectedFamilyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      ]

      if (isSuperAdmin) {
        requests.push(
          fetch(`/api/inventory/asset-requests/family-config/${selectedFamilyId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assetRequestsEnabled: form.assetRequestsEnabled }),
          })
        )
      }

      const [configRes, assetRequestsRes] = await Promise.all(requests)
      const data = await configRes.json()

      if (data.success && (!assetRequestsRes || assetRequestsRes.ok)) {
        await loadConfig(selectedFamilyId)
        toast({ title: 'Guardado', description: 'Configuración actualizada correctamente' })
      } else {
        const assetError =
          assetRequestsRes && !assetRequestsRes.ok
            ? await assetRequestsRes.json().catch(() => ({}))
            : null
        toast({
          title: 'Error',
          description: data.error || assetError?.error || 'Error al guardar',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [selectedFamilyId, residualError, form, useModeConfig, toast, isSuperAdmin, loadConfig])

  // ── Save global rules ──
  const handleSaveGlobal = useCallback(async () => {
    setSavingGlobal(true)
    try {
      const res = await fetch('/api/settings/inventory', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalRulesToApiPayload(globalRules)),
      })
      if (res.ok) {
        await loadGlobalRules()
        toast({ title: 'Guardado', description: 'Reglas globales actualizadas' })
      } else {
        const data = await res.json().catch(() => ({}))
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar (requiere Super Administrador)',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSavingGlobal(false)
    }
  }, [globalRules, toast, loadGlobalRules])

  const handleReload = useCallback(async () => {
    await loadFamilies()
    await loadGlobalRules()
    if (selectedFamilyId) await loadConfig(selectedFamilyId)
  }, [loadFamilies, loadGlobalRules, loadConfig, selectedFamilyId])

  // ── Form helpers ──
  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleSubtype = useCallback((subtype: AssetSubtype) => {
    setForm(prev => ({
      ...prev,
      allowedSubtypes: prev.allowedSubtypes.includes(subtype)
        ? prev.allowedSubtypes.filter(s => s !== subtype)
        : [...prev.allowedSubtypes, subtype],
    }))
  }, [])

  const toggleVisible = useCallback((section: FormSection, checked: boolean) => {
    if (checked) {
      setForm(prev => ({ ...prev, visibleSections: [...prev.visibleSections, section] }))
    } else {
      setForm(prev => ({
        ...prev,
        visibleSections: prev.visibleSections.filter(s => s !== section),
        requiredSections: prev.requiredSections.filter(s => s !== section),
      }))
    }
  }, [])

  const toggleRequired = useCallback((section: FormSection, checked: boolean) => {
    if (checked) {
      setForm(prev => ({
        ...prev,
        requiredSections: [...prev.requiredSections, section],
        visibleSections: prev.visibleSections.includes(section)
          ? prev.visibleSections
          : [...prev.visibleSections, section],
      }))
    } else {
      setForm(prev => ({
        ...prev,
        requiredSections: prev.requiredSections.filter(s => s !== section),
      }))
    }
  }, [])

  const getModeConfig = useCallback(
    (mode: AcquisitionMode): ModeSectionConfig =>
      form.sectionsByMode[mode] ?? { ...DEFAULT_MODE_CONFIG },
    [form.sectionsByMode]
  )

  const setModeVisible = useCallback(
    (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
      setForm(prev => {
        const current = prev.sectionsByMode[mode] ?? { ...DEFAULT_MODE_CONFIG }
        const visible = checked
          ? [...current.visible, section]
          : current.visible.filter(s => s !== section)
        const required = checked ? current.required : current.required.filter(s => s !== section)
        return {
          ...prev,
          sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
        }
      })
    },
    []
  )

  const setModeRequired = useCallback(
    (mode: AcquisitionMode, section: FormSection, checked: boolean) => {
      setForm(prev => {
        const current = prev.sectionsByMode[mode] ?? { ...DEFAULT_MODE_CONFIG }
        const required = checked
          ? [...current.required, section]
          : current.required.filter(s => s !== section)
        const visible = checked
          ? current.visible.includes(section)
            ? current.visible
            : [...current.visible, section]
          : current.visible
        return {
          ...prev,
          sectionsByMode: { ...prev.sectionsByMode, [mode]: { visible, required } },
        }
      })
    },
    []
  )

  const validateResidual = useCallback((val: string) => {
    if (val === '') {
      setResidualError(null)
      return
    }
    const n = parseFloat(val)
    if (isNaN(n) || n < 0 || n > 100) setResidualError('Debe ser un valor entre 0 y 100')
    else setResidualError(null)
  }, [])

  const setGlobal = useCallback(<K extends keyof GlobalRules>(key: K, value: GlobalRules[K]) => {
    setGlobalRules(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleSelectFamily = useCallback(
    (familyId: string) => {
      setSelectedFamilyId(familyId)
      router.replace(`/admin/settings/inventory?familyId=${familyId}`, { scroll: false })
    },
    [router]
  )

  const selectedFamily = families.find(f => f.id === selectedFamilyId)

  return {
    isSuperAdmin,
    // Data
    families,
    selectedFamilyId,
    selectedFamily,
    form,
    globalRules,

    // State
    loadingFamilies,
    loadingConfig,
    loadingGlobal,
    saving,
    savingGlobal,
    residualError,
    activeModeTab,
    setActiveModeTab,
    useModeConfig,
    setUseModeConfig,

    // Actions
    loadFamilies,
    loadGlobalRules,
    handleReload,
    handleSelectFamily,
    handleToggleInventory,
    handleSave,
    handleSaveGlobal,
    setField,
    setGlobal,
    toggleSubtype,
    toggleVisible,
    toggleRequired,
    getModeConfig,
    setModeVisible,
    setModeRequired,
    validateResidual,
  }
}
