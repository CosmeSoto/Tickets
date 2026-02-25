/**
 * Hook para memoización inteligente de componentes
 * Previene re-renders innecesarios
 */

import { useCallback, useMemo, useRef, useEffect } from 'react'
import { isEqual } from 'lodash'

/**
 * Hook para memoizar valores con comparación profunda
 */
export function useDeepMemo<T>(value: T): T {
  const ref = useRef<T>(value)

  if (!isEqual(ref.current, value)) {
    ref.current = value
  }

  return ref.current
}

/**
 * Hook para memoizar callbacks con dependencias profundas
 */
export function useDeepCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: any[]
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(callback, useDeepMemo(deps))
}

/**
 * Hook para detectar cambios en props
 * Útil para debugging de re-renders
 */
export function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  const previousProps = useRef<Record<string, any> | undefined>(undefined)

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props })
      const changedProps: Record<string, { from: any; to: any }> = {}

      allKeys.forEach(key => {
        if (!isEqual(previousProps.current?.[key], props[key])) {
          changedProps[key] = {
            from: previousProps.current?.[key],
            to: props[key],
          }
        }
      })

      if (Object.keys(changedProps).length > 0) {
        console.log('[why-did-you-update]', name, changedProps)
      }
    }

    previousProps.current = props
  })
}

/**
 * Hook para memoizar arrays con comparación profunda
 */
export function useDeepMemoArray<T>(array: T[]): T[] {
  return useDeepMemo(array)
}

/**
 * Hook para memoizar objetos con comparación profunda
 */
export function useDeepMemoObject<T extends Record<string, any>>(obj: T): T {
  return useDeepMemo(obj)
}

/**
 * Hook para prevenir re-renders cuando el valor no cambia
 */
export function useStableValue<T>(value: T, compareFn?: (a: T, b: T) => boolean): T {
  const ref = useRef<T>(value)
  const compare = compareFn || isEqual

  if (!compare(ref.current, value)) {
    ref.current = value
  }

  return ref.current
}

/**
 * Hook para memoizar funciones de filtrado
 */
export function useMemoizedFilter<T>(
  items: T[],
  filterFn: (item: T) => boolean,
  deps: any[] = []
): T[] {
  const stableItems = useDeepMemoArray(items)
  const stableDeps = useDeepMemoArray(deps)

  return useMemo(
    () => stableItems.filter(filterFn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableItems, filterFn, ...stableDeps]
  )
}

/**
 * Hook para memoizar funciones de mapeo
 */
export function useMemoizedMap<T, R>(
  items: T[],
  mapFn: (item: T, index: number) => R,
  deps: any[] = []
): R[] {
  const stableItems = useDeepMemoArray(items)
  const stableDeps = useDeepMemoArray(deps)

  return useMemo(
    () => stableItems.map(mapFn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableItems, mapFn, ...stableDeps]
  )
}

/**
 * Hook para memoizar funciones de ordenamiento
 */
export function useMemoizedSort<T>(
  items: T[],
  compareFn: (a: T, b: T) => number,
  deps: any[] = []
): T[] {
  const stableItems = useDeepMemoArray(items)
  const stableDeps = useDeepMemoArray(deps)

  return useMemo(
    () => [...stableItems].sort(compareFn),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stableItems, compareFn, ...stableDeps]
  )
}
