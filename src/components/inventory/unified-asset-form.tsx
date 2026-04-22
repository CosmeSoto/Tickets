'use client'

import { useState, useEffect, useRef } from 'react'
import { FamilySelector } from '@/components/inventory/family-selector'
import { SubtypeSelector } from '@/components/inventory/subtype-selector'
import type { AssetSubtype, FamilyConfig } from '@/lib/inventory/family-config-types'
import { EquipmentAssetForm } from '@/components/inventory/asset-forms/EquipmentAssetForm'
import { MROAssetForm } from '@/components/inventory/asset-forms/MROAssetForm'
import { LicenseAssetForm } from '@/components/inventory/asset-forms/LicenseAssetForm'
import { useInventoryFamilies } from '@/contexts/families-context'
import { useFamilyOptions } from '@/hooks/use-family-options'

interface UnifiedAssetFormProps {
  onSuccess?: (asset: unknown) => void
  onCancel?: () => void
  defaultFamilyId?: string
}

interface Family { id: string; name: string; icon?: string | null; color?: string | null; code: string }

export function UnifiedAssetForm({ onSuccess, onCancel, defaultFamilyId }: UnifiedAssetFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(defaultFamilyId ?? null)
  const [familyConfig, setFamilyConfig] = useState<FamilyConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(10)

  // Familias de inventario desde el contexto global (cache Redis, sin peticion extra) - memoizadas
  const { families, loading: loadingFamilies } = useFamilyOptions()

  // Suppress unused warning for onCancel — kept for API compatibility
  void onCancel

  const initialized = useRef(false)

  useEffect(() => {
    fetch('/api/config/upload-limits').then(r => r.json()).then(d => {
      if (d.maxFileSizeMB) setMaxFileSizeMB(d.maxFileSizeMB)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!initialized.current && defaultFamilyId) {
      initialized.current = true
      handleFamilySelect(defaultFamilyId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFamilySelect = async (familyId: string) => {
    setSelectedFamilyId(familyId)
    setLoadingConfig(true)
    try {
      const res = await fetch(`/api/inventory/family-config/${familyId}`)
      if (res.ok) {
        const config: FamilyConfig = await res.json()
        setFamilyConfig(config)
        if (config.allowedSubtypes.length === 1) {
          setSelectedSubtype(config.allowedSubtypes[0])
          setStep(3)
        } else {
          setStep(2)
        }
      }
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleSubtypeSelect = (subtype: AssetSubtype) => {
    setSelectedSubtype(subtype)
    setStep(3)
  }

  const handleBack = () => {
    if (familyConfig && familyConfig.allowedSubtypes.length > 1) {
      setStep(2)
    } else {
      setStep(1)
    }
  }

  const handleSubtypeSubmit = async (payload: Record<string, unknown>) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const fullPayload = { ...payload, subtype: selectedSubtype, familyId: selectedFamilyId }
      const res = await fetch('/api/inventory/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
      })
      if (res.ok) {
        const asset = await res.json()
        onSuccess?.(asset)
      } else {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error ?? 'Error al crear el activo.')
      }
    } catch {
      setSubmitError('Error de conexión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Paso 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium">Selecciona una familia</p>
          {loadingFamilies ? <p className="text-sm text-muted-foreground">Cargando familias...</p> : (
            <FamilySelector families={families} selectedId={selectedFamilyId} onSelect={handleFamilySelect} disabled={loadingConfig} />
          )}
          {loadingConfig && <p className="text-sm text-muted-foreground">Cargando configuración...</p>}
        </div>
      )}

      {/* Paso 2 */}
      {step === 2 && familyConfig && (
        <div className="space-y-4">
          <button type="button" onClick={() => setStep(1)} className="text-sm text-muted-foreground hover:text-foreground">← Cambiar familia</button>
          <p className="text-sm font-medium">Selecciona el tipo de activo</p>
          <SubtypeSelector allowedSubtypes={familyConfig.allowedSubtypes} onSelect={handleSubtypeSelect} />
        </div>
      )}

      {/* Paso 3 */}
      {step === 3 && selectedSubtype && familyConfig && (
        <div>
          {selectedSubtype === 'EQUIPMENT' && (
            <EquipmentAssetForm
              familyId={selectedFamilyId!}
              familyCode={families.find(f => f.id === selectedFamilyId)?.code}
              familyConfig={familyConfig}
              onSubmit={handleSubtypeSubmit}
              onBack={handleBack}
              submitting={submitting}
              submitError={submitError}
              maxFileSizeMB={maxFileSizeMB}
            />
          )}
          {selectedSubtype === 'MRO' && (
            <MROAssetForm
              familyId={selectedFamilyId!}
              familyConfig={familyConfig}
              onSubmit={handleSubtypeSubmit}
              onBack={handleBack}
              submitting={submitting}
              submitError={submitError}
              maxFileSizeMB={maxFileSizeMB}
            />
          )}
          {selectedSubtype === 'LICENSE' && (
            <LicenseAssetForm
              familyId={selectedFamilyId!}
              familyConfig={familyConfig}
              onSubmit={handleSubtypeSubmit}
              onBack={handleBack}
              submitting={submitting}
              submitError={submitError}
              maxFileSizeMB={maxFileSizeMB}
            />
          )}
        </div>
      )}
    </div>
  )
}
