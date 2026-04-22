'use client'

/**
 * ContractPicker — selector de contrato embebido en formularios de activos.
 *
 * Permite al usuario:
 *  1. Vincular un contrato existente (búsqueda)
 *  2. Crear un contrato nuevo directamente desde el modal
 *
 * Se usa en EquipmentAssetForm y LicenseAssetForm cuando el modo de
 * adquisición es RENTAL o LOAN.
 */

import { useState } from 'react'
import { FileSignature, Plus, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useFetch } from '@/hooks/common/use-fetch'
import { ContractForm } from '@/components/contracts/contract-form'
import type { Contract } from '@/types/contracts'
import { CONTRACT_CATEGORY_LABELS } from '@/types/contracts'

interface Props {
  /** ID del contrato actualmente vinculado */
  value: string | null
  onChange: (contractId: string | null) => void
  /** Proveedor para pre-filtrar contratos */
  supplierId?: string | null
  /** Familia para pre-rellenar el formulario de nuevo contrato */
  familyId?: string | null
  disabled?: boolean
}

export function ContractPicker({ value, onChange, supplierId, familyId, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'link' | 'create'>('link')

  // Contratos activos disponibles para vincular
  const { data: contracts, reload } = useFetch<Contract>(
    '/api/contracts',
    {
      params: {
        status:     'ACTIVE',
        pageSize:   200,
        ...(supplierId ? { supplierId } : {}),
        ...(familyId   ? { familyId }   : {}),
      },
      transform: d => d.contracts ?? [],
      enabled: open && tab === 'link',
    }
  )

  // Contrato actualmente seleccionado (para mostrar el badge)
  const { data: selectedContracts } = useFetch<Contract>(
    value ? `/api/contracts/${value}` : '/api/contracts',
    {
      enabled: !!value,
      transform: d => d.id ? [d] : [],
    }
  )
  const selectedContract = selectedContracts[0] ?? null

  const handleLink = (contractId: string) => {
    onChange(contractId)
    setOpen(false)
  }

  const handleCreated = (contract: Contract) => {
    onChange(contract.id)
    reload()
    setOpen(false)
  }

  const handleClear = () => onChange(null)

  return (
    <div className="space-y-2">
      {/* Contrato vinculado */}
      {value && selectedContract ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <FileSignature className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedContract.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {selectedContract.contractNumber && (
                <span className="text-xs text-muted-foreground font-mono">
                  {selectedContract.contractNumber}
                </span>
              )}
              <Badge variant="outline" className="text-xs h-4">
                {CONTRACT_CATEGORY_LABELS[selectedContract.category] ?? selectedContract.category}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => setOpen(true)} disabled={disabled}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="sm"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleClear} disabled={disabled}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2"
          onClick={() => setOpen(true)} disabled={disabled}>
          <FileSignature className="h-4 w-4" />
          Vincular o crear contrato
        </Button>
      )}

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestionar contrato</DialogTitle>
            <DialogDescription>
              Vincula un contrato existente o crea uno nuevo para este activo.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={v => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link">Vincular existente</TabsTrigger>
              <TabsTrigger value="create">
                <Plus className="h-3.5 w-3.5 mr-1" /> Crear nuevo
              </TabsTrigger>
            </TabsList>

            {/* ── Tab: vincular ─────────────────────────────────────── */}
            <TabsContent value="link" className="space-y-4 pt-4">
              {contracts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSignature className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No hay contratos activos disponibles.</p>
                  <Button type="button" variant="outline" size="sm" className="mt-3"
                    onClick={() => setTab('create')}>
                    <Plus className="h-4 w-4 mr-1" /> Crear contrato nuevo
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Selecciona el contrato al que pertenece este activo:
                  </p>
                  <SearchableSelect
                    options={contracts.map(c => ({
                      value: c.id,
                      label: c.contractNumber
                        ? `${c.contractNumber} — ${c.name}`
                        : c.name,
                    }))}
                    value={value ?? ''}
                    onChange={handleLink}
                    placeholder="Buscar contrato..."
                    emptyLabel="Sin contratos disponibles"
                  />
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {contracts.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleLink(c.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                          value === c.id ? 'border-primary bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {c.contractNumber && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {c.contractNumber}
                                </span>
                              )}
                              {c.supplier && (
                                <span className="text-xs text-muted-foreground">
                                  {c.supplier.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {CONTRACT_CATEGORY_LABELS[c.category] ?? c.category}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: crear ────────────────────────────────────────── */}
            <TabsContent value="create" className="pt-4">
              <ContractForm
                contract={null}
                onSuccess={handleCreated}
                onCancel={() => setOpen(false)}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
