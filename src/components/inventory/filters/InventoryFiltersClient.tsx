'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { InventoryFilters } from './InventoryFilters'

interface InventoryFiltersClientProps {
  types: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  initialSearch?: string
  initialType?: string
  initialDepartment?: string
  initialStatus?: string
}

export function InventoryFiltersClient({
  types,
  departments,
  initialSearch,
  initialType,
  initialDepartment,
  initialStatus,
}: InventoryFiltersClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateQueryParams = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }

    router.push(`/inventory?${params.toString()}`)
  }

  const handleSearchChange = (search: string) => {
    updateQueryParams('search', search || null)
  }

  const handleTypeChange = (typeId: string | null) => {
    updateQueryParams('typeId', typeId)
  }

  const handleDepartmentChange = (departmentId: string | null) => {
    updateQueryParams('departmentId', departmentId)
  }

  const handleStatusChange = (status: string | null) => {
    updateQueryParams('status', status)
  }

  return (
    <InventoryFilters
      onSearchChange={handleSearchChange}
      onTypeChange={handleTypeChange}
      onDepartmentChange={handleDepartmentChange}
      onStatusChange={handleStatusChange}
      types={types}
      departments={departments}
      initialSearch={initialSearch}
      initialType={initialType}
      initialDepartment={initialDepartment}
      initialStatus={initialStatus}
    />
  )
}
