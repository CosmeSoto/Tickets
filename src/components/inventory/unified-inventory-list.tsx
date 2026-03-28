'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FamilyFilterBar } from '@/components/inventory/family-filter-bar'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { SubtypeBadge } from '@/components/inventory/subtype-badge'
import type { AssetSubtype } from '@/lib/inventory/family-config'

interface Family {
  id: string
  name: string
  icon?: string | null
  color?: string | null
}

interface UnifiedAsset {
  id: string
  name: string
  subtype: AssetSubtype
  familyId: string
  family: { name: string; icon: string | null; color: string | null }
  status: string
  code?: string
  createdAt: string
}

interface UnifiedAssetsResponse {
  items: UnifiedAsset[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface UnifiedInventoryListProps {
  initialFamilyId?: string
}

const PAGE_SIZE = 20

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function UnifiedInventoryList({ initialFamilyId }: UnifiedInventoryListProps) {
  const router = useRouter()
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(initialFamilyId ?? null)
  const [families, setFamilies] = useState<Family[]>([])
  const [assets, setAssets] = useState<UnifiedAsset[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  // Cargar familias para el filtro
  useEffect(() => {
    fetch('/api/inventory/families')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFamilies(data)
        else if (Array.isArray(data?.families)) setFamilies(data.families)
        else if (Array.isArray(data?.items)) setFamilies(data.items)
      })
      .catch(() => {})
  }, [])

  const fetchAssets = useCallback(
    async (familyId: string | null, currentPage: number) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(currentPage), pageSize: String(PAGE_SIZE) })
        if (familyId) params.set('familyId', familyId)
        const res = await fetch(`/api/inventory/assets?${params.toString()}`)
        if (!res.ok) return
        const data: UnifiedAssetsResponse = await res.json()
        setAssets(data.items)
        setTotalPages(data.totalPages)
      } finally {
        setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchAssets(selectedFamilyId, page)
  }, [selectedFamilyId, page, fetchAssets])

  function handleFamilyChange(familyId: string | null) {
    setSelectedFamilyId(familyId)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <FamilyFilterBar
        families={families}
        selectedId={selectedFamilyId}
        onChange={handleFamilyChange}
      />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Familia</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Código / ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Fecha creación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No hay activos para mostrar.
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => router.push(`/inventory/${asset.subtype.toLowerCase()}/${asset.id}`)}
                >
                  <td className="px-4 py-3">
                    <SubtypeBadge subtype={asset.subtype} size="sm" />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <FamilyBadge family={asset.family} size="sm" />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{asset.name}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{asset.code ?? asset.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{asset.status}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(asset.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Anterior
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  )
}
