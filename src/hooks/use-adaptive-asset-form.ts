'use client'
import { useState, useEffect } from 'react'
import { DEFAULT_USEFUL_LIFE_YEARS, getRecommendedDepreciationMethod, familySupportsDepreciation } from '@/lib/inventory/depreciation'

interface FamilyTypes {
  equipmentTypes: Array<{ id: string; name: string; code: string }>
  consumableTypes: Array<{ id: string; name: string; code: string }>
  licenseTypes: Array<{ id: string; name: string; code: string }>
}

export function useAdaptiveAssetForm() {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null)
  const [selectedFamilyCode, setSelectedFamilyCode] = useState<string | null>(null)
  const [familyTypes, setFamilyTypes] = useState<FamilyTypes | null>(null)
  const [loadingTypes, setLoadingTypes] = useState(false)

  // Fetch tipos cuando cambia la familia
  useEffect(() => {
    if (!selectedFamilyId) { setFamilyTypes(null); return }
    setLoadingTypes(true)
    fetch(`/api/inventory/families/${selectedFamilyId}/types`)
      .then(r => r.json())
      .then(data => setFamilyTypes(data))
      .finally(() => setLoadingTypes(false))
  }, [selectedFamilyId])

  // Helpers de visibilidad
  const showDepreciationFields = (acquisitionMode: string | null) =>
    acquisitionMode === 'FIXED_ASSET' && selectedFamilyCode
      ? familySupportsDepreciation(selectedFamilyCode)
      : false

  const showContractFields = (familyCode: string | null) =>
    ['SERVICES', 'SECURITY', 'ADMINISTRATIVE'].includes(familyCode ?? '')

  const getDefaultDepreciationMethod = (familyCode: string | null, typeName?: string) =>
    getRecommendedDepreciationMethod(familyCode ?? '', typeName)

  const getDefaultUsefulLife = (familyCode: string | null) =>
    DEFAULT_USEFUL_LIFE_YEARS[familyCode ?? ''] ?? 5

  const selectFamily = (familyId: string, familyCode: string) => {
    setSelectedFamilyId(familyId)
    setSelectedFamilyCode(familyCode)
  }

  return {
    selectedFamilyId,
    selectedFamilyCode,
    familyTypes,
    loadingTypes,
    selectFamily,
    showDepreciationFields,
    showContractFields,
    getDefaultDepreciationMethod,
    getDefaultUsefulLife,
  }
}
