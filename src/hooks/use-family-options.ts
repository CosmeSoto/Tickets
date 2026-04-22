import { useMemo } from 'react'
import { useInventoryFamilies } from '@/contexts/families-context'

/**
 * Hook optimizado para obtener opciones de familias memoizadas.
 * Evita recalcular el array en cada render.
 */
export function useFamilyOptions() {
  const { families: rawFamilies, loading } = useInventoryFamilies()

  const families = useMemo(
    () =>
      rawFamilies.map(f => ({
        id: f.id,
        name: f.name,
        code: f.code ?? f.name.slice(0, 3).toUpperCase(),
        color: f.color ?? null,
        icon: f.icon ?? null,
      })),
    [rawFamilies]
  )

  return { families, loading }
}
