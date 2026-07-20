/**
 * Category Selector Wrapper
 *
 * Intelligently switches between enhanced CategorySelector and fallback
 * based on feature flags and browser capabilities
 */

'use client'

import React, { useRef } from 'react'
import { CategorySelector } from './CategorySelector'
import { CategorySelectorFallback } from './CategorySelectorFallback'
import { useCategorySelectorFeatureFlags } from '../hooks/useFeatureFlags'
import { useCategoriesQuery } from '../hooks/useCategoriesQuery'
import { initializeCategorySelectorFlags } from '../config/feature-flags'
import type { Category } from '../types'
import { AlertCircle, Layers } from 'lucide-react'

export interface CategorySelectorWrapperProps {
  value?: string
  onChange: (categoryId: string) => void
  ticketTitle?: string
  ticketDescription?: string
  clientId?: string
  familyId?: string
  error?: string
  disabled?: boolean
  /** Si true, exige familyId antes de mostrar categorías */
  requireFamily?: boolean
}

/**
 * Wrapper: feature flags + carga de categorías por familia (API).
 */
export function CategorySelectorWrapper({
  value,
  onChange,
  ticketTitle = '',
  ticketDescription = '',
  clientId,
  familyId,
  error,
  disabled = false,
  requireFamily = false,
}: CategorySelectorWrapperProps) {
  const flagsInitialized = useRef(false)
  if (!flagsInitialized.current) {
    initializeCategorySelectorFlags()
    flagsInitialized.current = true
  }
  const flags = useCategorySelectorFeatureFlags()

  // Pedir categorías del área al API (consumer). Evita filtrar en cliente
  // sobre un listado operational incompleto (familias asignadas / nativa).
  const {
    categories: fetchedCategories,
    isLoading,
    error: queryError,
  } = useCategoriesQuery({
    familyId,
    enabled: !requireFamily || Boolean(familyId),
  })

  const categories = React.useMemo(() => {
    // Si el API ya filtró por familyId, no re-filtrar en cliente
    // (evita perder categorías con familyId null pero department correcto)
    return fetchedCategories
  }, [fetchedCategories])

  if (requireFamily && !familyId) {
    return (
      <div className='flex items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
        <Layers className='h-4 w-4 mt-0.5 shrink-0' />
        <p>Selecciona primero el área de soporte para ver sus categorías.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2'></div>
          <p className='text-sm text-muted-foreground'>Cargando categorías...</p>
        </div>
      </div>
    )
  }

  if (queryError) {
    return (
      <div className='flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
        <AlertCircle className='h-4 w-4 mt-0.5 shrink-0' />
        <p>{queryError.message || 'Error al cargar categorías'}</p>
      </div>
    )
  }

  if (flags.fallbackMode || !flags.useEnhancedSelector) {
    return (
      <CategorySelectorFallback
        value={value}
        onChange={onChange}
        categories={categories as Category[]}
        error={error}
        disabled={disabled}
      />
    )
  }

  return (
    <CategorySelector
      key={familyId || 'no-family'}
      value={value}
      onChange={onChange}
      ticketTitle={ticketTitle}
      ticketDescription={ticketDescription}
      clientId={clientId || ''}
      categories={categories}
      error={error}
      disabled={disabled}
      emptyMessage={
        familyId
          ? 'No hay categorías activas para esta área. Ve a Tickets → Categorías, filtra por esta área y crea o activa categorías (los departamentos del área deben tener la familia asignada).'
          : 'No hay categorías disponibles.'
      }
    />
  )
}
