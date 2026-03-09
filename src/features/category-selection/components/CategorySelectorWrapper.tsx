/**
 * Category Selector Wrapper
 * 
 * Intelligently switches between enhanced CategorySelector and fallback
 * based on feature flags and browser capabilities
 */

'use client';

import React, { useEffect } from 'react';
import { CategorySelector } from './CategorySelector';
import { CategorySelectorFallback } from './CategorySelectorFallback';
import { useCategorySelectorFeatureFlags } from '../hooks/useFeatureFlags';
import { useCategoriesQuery } from '../hooks/useCategoriesQuery';
import { initializeCategorySelectorFlags } from '../config/feature-flags';
import type { Category } from '../types';

export interface CategorySelectorWrapperProps {
  value?: string;
  onChange: (categoryId: string) => void;
  ticketTitle?: string;
  ticketDescription?: string;
  clientId?: string;
  error?: string;
  disabled?: boolean;
}

/**
 * Wrapper component that handles feature flag initialization and
 * switches between enhanced and fallback selectors
 */
export function CategorySelectorWrapper({
  value,
  onChange,
  ticketTitle = '',
  ticketDescription = '',
  clientId,
  error,
  disabled = false,
}: CategorySelectorWrapperProps) {
  const flags = useCategorySelectorFeatureFlags();
  const { categories, isLoading } = useCategoriesQuery();

  // Initialize feature flags on mount
  useEffect(() => {
    initializeCategorySelectorFlags();
  }, []);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Cargando categorías...</p>
        </div>
      </div>
    );
  }

  // Use fallback if enhanced selector is disabled or browser doesn't support it
  if (flags.fallbackMode || !flags.useEnhancedSelector) {
    return (
      <CategorySelectorFallback
        value={value}
        onChange={onChange}
        categories={categories as Category[]}
        error={error}
        disabled={disabled}
      />
    );
  }

  // Use enhanced selector
  return (
    <CategorySelector
      value={value}
      onChange={onChange}
      ticketTitle={ticketTitle}
      ticketDescription={ticketDescription}
      clientId={clientId || ''}
      categories={categories}
      error={error}
      disabled={disabled}
    />
  );
}
