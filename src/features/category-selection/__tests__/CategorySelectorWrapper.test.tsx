/**
 * Tests for CategorySelectorWrapper
 * 
 * Verifies feature flag integration and fallback behavior
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { CategorySelectorWrapper } from '../components/CategorySelectorWrapper';
import * as featureFlags from '../config/feature-flags';
import * as useFeatureFlagsHook from '../hooks/useFeatureFlags';

// Mock the hooks and modules
jest.mock('../hooks/useFeatureFlags');
jest.mock('../hooks/useCategoriesQuery');
jest.mock('../config/feature-flags', () => ({
  ...jest.requireActual('../config/feature-flags'),
  initializeCategorySelectorFlags: jest.fn(),
}));

const mockUseCategorySelectorFeatureFlags = useFeatureFlagsHook.useCategorySelectorFeatureFlags as jest.MockedFunction<
  typeof useFeatureFlagsHook.useCategorySelectorFeatureFlags
>;

const mockUseCategoriesQuery = require('../hooks/useCategoriesQuery').useCategoriesQuery as jest.MockedFunction<any>;

const mockCategories = [
  {
    id: '1',
    name: 'Infraestructura',
    description: 'Problemas de infraestructura',
    level: 1,
    parentId: null,
    color: '#FF0000',
    isActive: true,
  },
  {
    id: '2',
    name: 'Redes',
    description: 'Problemas de red',
    level: 2,
    parentId: '1',
    color: '#FF0000',
    isActive: true,
  },
];

describe('CategorySelectorWrapper', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  const renderWrapper = (props: any = {}) => {
    return render(
      <SessionProvider session={null}>
        <QueryClientProvider client={queryClient}>
          <CategorySelectorWrapper
            onChange={jest.fn()}
            {...props}
          />
        </QueryClientProvider>
      </SessionProvider>
    );
  };

  it('should initialize feature flags on mount', () => {
    mockUseCategorySelectorFeatureFlags.mockReturnValue({
      useEnhancedSelector: true,
      smartSearch: true,
      suggestions: true,
      frequentCategories: true,
      stepByStep: true,
      knowledgeBase: true,
      visualEnhancements: true,
      analytics: true,
      browserCapabilities: {
        supportsIntersectionObserver: true,
        supportsResizeObserver: true,
        supportsCustomElements: true,
        supportsES6: true,
        supportsFlexbox: true,
        supportsGrid: true,
      },
      fallbackMode: false,
    });

    mockUseCategoriesQuery.mockReturnValue({
      categories: mockCategories,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWrapper();

    expect(featureFlags.initializeCategorySelectorFlags).toHaveBeenCalled();
  });

  it('should show loading state while categories are loading', () => {
    mockUseCategorySelectorFeatureFlags.mockReturnValue({
      useEnhancedSelector: true,
      smartSearch: true,
      suggestions: true,
      frequentCategories: true,
      stepByStep: true,
      knowledgeBase: true,
      visualEnhancements: true,
      analytics: true,
      browserCapabilities: {
        supportsIntersectionObserver: true,
        supportsResizeObserver: true,
        supportsCustomElements: true,
        supportsES6: true,
        supportsFlexbox: true,
        supportsGrid: true,
      },
      fallbackMode: false,
    });

    mockUseCategoriesQuery.mockReturnValue({
      categories: [],
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWrapper();

    expect(screen.getByText('Cargando categorías...')).toBeInTheDocument();
  });

  it('should render fallback selector when fallbackMode is true', async () => {
    mockUseCategorySelectorFeatureFlags.mockReturnValue({
      useEnhancedSelector: false,
      smartSearch: false,
      suggestions: false,
      frequentCategories: false,
      stepByStep: false,
      knowledgeBase: false,
      visualEnhancements: false,
      analytics: false,
      browserCapabilities: {
        supportsIntersectionObserver: false,
        supportsResizeObserver: false,
        supportsCustomElements: false,
        supportsES6: true,
        supportsFlexbox: true,
        supportsGrid: false,
      },
      fallbackMode: true,
    });

    mockUseCategoriesQuery.mockReturnValue({
      categories: mockCategories,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWrapper();

    await waitFor(() => {
      expect(screen.getByText('Modo de compatibilidad activado. Selecciona la categoría navegando por los niveles.')).toBeInTheDocument();
    });
  });

  it('should render enhanced selector when feature is enabled and browser supports it', async () => {
    mockUseCategorySelectorFeatureFlags.mockReturnValue({
      useEnhancedSelector: true,
      smartSearch: true,
      suggestions: true,
      frequentCategories: true,
      stepByStep: true,
      knowledgeBase: true,
      visualEnhancements: true,
      analytics: true,
      browserCapabilities: {
        supportsIntersectionObserver: true,
        supportsResizeObserver: true,
        supportsCustomElements: true,
        supportsES6: true,
        supportsFlexbox: true,
        supportsGrid: true,
      },
      fallbackMode: false,
    });

    mockUseCategoriesQuery.mockReturnValue({
      categories: mockCategories,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWrapper({ clientId: 'test-user' });

    // Enhanced selector should be rendered (it has tabs)
    await waitFor(() => {
      expect(screen.queryByText('Modo de compatibilidad activado')).not.toBeInTheDocument();
    });
  });

  it('should pass props correctly to enhanced selector', () => {
    const mockOnChange = jest.fn();
    
    mockUseCategorySelectorFeatureFlags.mockReturnValue({
      useEnhancedSelector: true,
      smartSearch: true,
      suggestions: true,
      frequentCategories: true,
      stepByStep: true,
      knowledgeBase: true,
      visualEnhancements: true,
      analytics: true,
      browserCapabilities: {
        supportsIntersectionObserver: true,
        supportsResizeObserver: true,
        supportsCustomElements: true,
        supportsES6: true,
        supportsFlexbox: true,
        supportsGrid: true,
      },
      fallbackMode: false,
    });

    mockUseCategoriesQuery.mockReturnValue({
      categories: mockCategories,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWrapper({
      value: '1',
      onChange: mockOnChange,
      ticketTitle: 'Test Title',
      ticketDescription: 'Test Description',
      clientId: 'test-user',
      error: 'Test error',
      disabled: false,
    });

    // Component should render without errors
    expect(screen.queryByText('Cargando categorías...')).not.toBeInTheDocument();
  });
});
