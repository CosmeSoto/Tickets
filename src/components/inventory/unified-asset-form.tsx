'use client'

import { useState, useEffect, useRef } from 'react'
import { FamilySelector } from '@/components/inventory/family-selector'
import { SubtypeSelector } from '@/components/inventory/subtype-selector'
import { StepHeader } from '@/components/inventory/shared/StepHeader'
import type { AssetSubtype, FamilyConfig } from '@/lib/inventory/family-config-types'
import { EquipmentAssetForm } from '@/components/inventory/asset-forms/EquipmentAssetForm'
import { MROAssetForm } from '@/components/inventory/asset-forms/MROAssetForm'
import { LicenseAssetForm } from '@/components/inventory/asset-forms/LicenseAssetForm'
import { useInventoryFamilies } from '@/contexts/families-context'
import { toast } from 'sonner'

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
      const jsonPayload: Record<string, unknown> = {
        ...payload,
        subtype: selectedSubtype,
        familyId: selectedFamilyId,
      }
      delete jsonPayload.attachments

      const res = await fetch('/api/inventory/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jsonPayload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errorMessage = data.error ?? 'Error al crear el activo.'
        setSubmitError(errorMessage)
        toast.error(errorMessage, {
          description: 'Inténtalo de nuevo',
        })
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

      toast.success('Activo creado exitosamente')

      setTimeout(() => onSuccess?.(asset), 1500)
    } catch {
      const errorMessage = 'Error de conexión.'
      setSubmitError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-5'>
      {/* ── Paso 1: Selección de familia ─────────────────────────────────── */}
      {step === 1 && (
        <div className='space-y-4'>
          <StepHeader
            mode='individual'
            step={1}
            description='Elige el área de la organización a la que pertenece este activo.'
          />{' '}
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
          <StepHeader
            mode='individual'
            step={2}
            description='Indica si es un equipo físico, una licencia/contrato o un consumible.'
            familyName={selectedFamily?.name}
            familyColor={selectedFamily?.color}
            backLabel='Cambiar familia'
            onBack={handleBack}
          />
          <SubtypeSelector
            allowedSubtypes={familyConfig.allowedSubtypes}
            onSelect={handleSubtypeSelect}
          />
        </div>
      )}

      {/* ── Paso 3: Formulario ───────────────────────────────────────────── */}
      {step === 3 && selectedSubtype && familyConfig && (
        <div className='space-y-4'>
          <StepHeader
            mode='individual'
            step={3}
            description='Rellena los datos del activo. Los campos marcados con * son obligatorios.'
            familyName={selectedFamily?.name}
            familyColor={selectedFamily?.color}
            subtypeName={selectedSubtype}
            backLabel='Cambiar tipo'
            onBack={handleBack}
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
