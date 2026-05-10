'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FamilySelector } from '@/components/inventory/family-selector'
import { SubtypeSelector } from '@/components/inventory/subtype-selector'
import { CreationBreadcrumb } from '@/components/inventory/shared/CreationBreadcrumb'
import type { AssetSubtype, FamilyConfig } from '@/lib/inventory/family-config-types'
import { EquipmentAssetForm } from '@/components/inventory/asset-forms/EquipmentAssetForm'
import { MROAssetForm } from '@/components/inventory/asset-forms/MROAssetForm'
import { LicenseAssetForm } from '@/components/inventory/asset-forms/LicenseAssetForm'
import { useInventoryFamilies } from '@/contexts/families-context'

interface UnifiedAssetFormProps {
  onSuccess?: (asset: unknown) => void
  onCancel?: () => void
  defaultFamilyId?: string
  onStepChange?: (step: 1 | 2 | 3) => void
}

export function UnifiedAssetForm({
  onSuccess,
  onCancel,
  defaultFamilyId,
  onStepChange,
}: UnifiedAssetFormProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Notificar al padre cuando cambia el paso
  const goToStep = (s: 1 | 2 | 3) => {
    setStep(s)
    onStepChange?.(s)
  }
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(defaultFamilyId ?? null)
  const [familyConfig, setFamilyConfig] = useState<FamilyConfig | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [selectedSubtype, setSelectedSubtype] = useState<AssetSubtype | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [maxFileSizeMB, setMaxFileSizeMB] = useState(10)

  // Familias desde contexto global
  const { families, loading: loadingFamilies } = useInventoryFamilies()

  // Datos de la familia seleccionada para mostrar en el breadcrumb
  const selectedFamily = families.find(f => f.id === selectedFamilyId)

  void onCancel

  const initialized = useRef(false)

  useEffect(() => {
    fetch('/api/config/upload-limits')
      .then(r => r.json())
      .then(d => {
        if (d.maxFileSizeMB) setMaxFileSizeMB(d.maxFileSizeMB)
      })
      .catch(() => {})
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
        const json = await res.json()
        const config: FamilyConfig = json.data ?? json
        setFamilyConfig(config)
        const subtypes = config.allowedSubtypes ?? []
        if (subtypes.length === 1) {
          setSelectedSubtype(subtypes[0])
          goToStep(3)
        } else {
          goToStep(2)
        }
      }
    } finally {
      setLoadingConfig(false)
    }
  }

  const handleSubtypeSelect = (subtype: AssetSubtype) => {
    setSelectedSubtype(subtype)
    goToStep(3)
  }

  const handleBack = () => {
    if (step === 3) {
      if (familyConfig && (familyConfig.allowedSubtypes ?? []).length > 1) {
        setSelectedSubtype(null)
        goToStep(2)
      } else if (defaultFamilyId) {
        onCancel?.()
      } else {
        setSelectedSubtype(null)
        goToStep(1)
      }
    } else if (step === 2) {
      if (defaultFamilyId) {
        onCancel?.()
      } else {
        goToStep(1)
      }
    }
  }

  const handleSubtypeSubmit = async (payload: Record<string, unknown>) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const attachments = (payload.attachments as File[] | undefined) ?? []
      const jsonPayload = { ...payload, subtype: selectedSubtype, familyId: selectedFamilyId }
      delete jsonPayload.attachments

      const res = await fetch('/api/inventory/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonPayload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmitError(data.error ?? 'Error al crear el activo.')
        return
      }

      const asset = await res.json()

      if (attachments.length > 0 && selectedSubtype === 'EQUIPMENT' && asset.id) {
        const uploadUrl = `/api/inventory/equipment/${asset.id}/attachments`
        await Promise.allSettled(
          attachments.map(async file => {
            const fd = new FormData()
            fd.append('file', file)
            await fetch(uploadUrl, { method: 'POST', body: fd })
          })
        )
      }

      onSuccess?.(asset)
    } catch {
      setSubmitError('Error de conexión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-5'>
      {/* ── Paso 1: Selección de familia ─────────────────────────────────── */}
      {step === 1 && (
        <div className='space-y-4'>
          <CreationBreadcrumb mode='individual' step={1} />
          <p className='text-sm font-medium text-foreground'>Selecciona una familia</p>
          {loadingFamilies ? (
            <p className='text-sm text-muted-foreground'>Cargando familias...</p>
          ) : (
            <FamilySelector
              families={families}
              selectedId={selectedFamilyId}
              onSelect={handleFamilySelect}
              disabled={loadingConfig}
            />
          )}
          {loadingConfig && (
            <p className='text-sm text-muted-foreground'>Cargando configuración...</p>
          )}
        </div>
      )}

      {/* ── Paso 2: Selección de subtipo ─────────────────────────────────── */}
      {step === 2 && familyConfig && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <CreationBreadcrumb
              mode='individual'
              step={2}
              familyName={selectedFamily?.name}
              familyColor={selectedFamily?.color}
            />
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={handleBack}
              className='text-muted-foreground hover:text-foreground -mr-2'
            >
              <ArrowLeft className='h-4 w-4 mr-1' />
              Cambiar familia
            </Button>
          </div>
          <p className='text-sm font-medium text-foreground'>Selecciona el tipo de activo</p>
          <SubtypeSelector
            allowedSubtypes={familyConfig.allowedSubtypes}
            onSelect={handleSubtypeSelect}
          />
        </div>
      )}

      {/* ── Paso 3: Formulario ───────────────────────────────────────────── */}
      {step === 3 && selectedSubtype && familyConfig && (
        <div className='space-y-4'>
          {/* Breadcrumb con familia + tipo */}
          <CreationBreadcrumb
            mode='individual'
            step={3}
            familyName={selectedFamily?.name}
            familyColor={selectedFamily?.color}
            subtypeName={selectedSubtype}
          />

          {selectedSubtype === 'EQUIPMENT' && (
            <EquipmentAssetForm
              familyId={selectedFamilyId!}
              familyCode={selectedFamily?.code}
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
