'use client'

/**
 * ContractPicker — selector de contrato embebido en formularios de activos/licencias.
 *
 * - Vincular existente (búsqueda)
 * - Crear rápido (campos mínimos)
 * - Formulario completo (mismo ContractForm del módulo Contratos)
 * - Completar/editar contrato vinculado sin salir del flujo
 */

import { useMemo, useState } from 'react'
import { FileSignature, Plus, X, ExternalLink, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useFetch } from '@/hooks/common/use-fetch'
import { QuickContractForm } from '@/components/contracts/quick-contract-form'
import { ContractForm } from '@/components/contracts/contract-form'
import type { Contract } from '@/types/contracts'
import { CONTRACT_CATEGORY_LABELS } from '@/types/contracts'
import {
  buildContractPrefill,
  type ContractPickerContext,
  type ContractPickerPrefill,
} from '@/lib/contracts/contract-picker-prefill'

interface Props {
  value: string | null
  onChange: (contractId: string | null) => void
  supplierId?: string | null
  familyId?: string | null
  disabled?: boolean
  /** Origen: licencia vs equipo (define categoría y línea sugerida) */
  context?: ContractPickerContext
  /** Datos del formulario padre para pre-rellenar creación */
  prefill?: ContractPickerPrefill | null
}

type PickerTab = 'link' | 'create-quick' | 'create-full' | 'edit'

export function ContractPicker({
  value,
  onChange,
  supplierId,
  familyId,
  disabled,
  context = 'license',
  prefill = null,
}: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>('link')

  const resolvedPrefill = useMemo(
    () =>
      buildContractPrefill(
        {
          ...prefill,
          supplierId: prefill?.supplierId ?? supplierId,
          familyId: prefill?.familyId ?? familyId,
        },
        context
      ),
    [prefill, supplierId, familyId, context]
  )

  const { data: contracts, reload } = useFetch<Contract>('/api/inventory/contracts', {
    params: {
      pageSize: 200,
      ...(supplierId ? { supplierId } : {}),
      ...(familyId ? { familyId } : {}),
    },
    transform: d => {
      const list = d.contracts ?? []
      return list.filter((c: { status: string }) => c.status === 'ACTIVE' || c.status === 'DRAFT')
    },
    enabled: open && tab === 'link',
  })

  const { data: selectedContracts, reload: reloadSelected } = useFetch<Contract>(
    value ? `/api/inventory/contracts/${value}` : '/api/inventory/contracts',
    {
      enabled: !!value,
      transform: d => (d.id ? [d] : []),
    }
  )
  const selectedContract = selectedContracts[0] ?? null

  const openPicker = (initialTab: PickerTab = 'link') => {
    setTab(initialTab)
    setOpen(true)
  }

  const handleLink = (contractId: string) => {
    onChange(contractId)
    setOpen(false)
  }

  const handleCreated = (contract: Contract) => {
    onChange(contract.id)
    reload()
    reloadSelected()
    setOpen(false)
  }

  const handleUpdated = (contract: Contract) => {
    onChange(contract.id)
    reload()
    reloadSelected()
    setOpen(false)
  }

  const handleClear = () => onChange(null)

  const contextLabel = context === 'license' ? 'licencia' : 'equipo'

  return (
    <div className='space-y-2'>
      {value && selectedContract ? (
        <div className='flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2'>
          <FileSignature className='h-4 w-4 text-muted-foreground flex-shrink-0' />
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-medium truncate'>{selectedContract.name}</p>
            <div className='flex items-center gap-2 mt-0.5 flex-wrap'>
              {selectedContract.contractNumber && (
                <span className='text-xs text-muted-foreground font-mono'>
                  {selectedContract.contractNumber}
                </span>
              )}
              <Badge variant='outline' className='text-xs h-4'>
                {CONTRACT_CATEGORY_LABELS[selectedContract.category] ?? selectedContract.category}
              </Badge>
            </div>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 px-2 text-xs'
              onClick={() => openPicker('edit')}
              disabled={disabled}
              title='Completar o editar contrato'
            >
              <Pencil className='h-3.5 w-3.5 mr-1' />
              Completar
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 w-7 p-0'
              onClick={() => openPicker('link')}
              disabled={disabled}
            >
              <ExternalLink className='h-3.5 w-3.5' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10'
              onClick={handleClear}
              disabled={disabled}
            >
              <X className='h-3.5 w-3.5' />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='w-full justify-start gap-2'
          onClick={() => openPicker('link')}
          disabled={disabled}
        >
          <FileSignature className='h-4 w-4' />
          Vincular contrato existente o crear uno nuevo
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-4xl max-h-[92vh]'>
          <DialogHeader>
            <DialogTitle>
              {tab === 'edit' ? 'Completar contrato' : 'Gestionar contrato'}
            </DialogTitle>
            <DialogDescription>
              {tab === 'edit'
                ? 'Agrega facturación, líneas, custodio y adjuntos sin salir de la creación de la ' +
                  contextLabel +
                  '.'
                : 'Vincula un contrato existente o créalo con los datos ya capturados en este formulario.'}
            </DialogDescription>
          </DialogHeader>

          <div className='overflow-y-auto max-h-[calc(92vh-120px)]'>
            {tab === 'edit' && selectedContract ? (
              <ContractForm
                contract={selectedContract}
                embedMode
                onSuccess={handleUpdated}
                onCancel={() => setOpen(false)}
              />
            ) : (
              <Tabs value={tab} onValueChange={v => setTab(v as PickerTab)}>
                <TabsList className='grid w-full grid-cols-3'>
                  <TabsTrigger value='link'>Vincular existente</TabsTrigger>
                  <TabsTrigger value='create-quick'>Crear rápido</TabsTrigger>
                  <TabsTrigger value='create-full'>Formulario completo</TabsTrigger>
                </TabsList>

                <TabsContent value='link' className='space-y-4 pt-4'>
                  {contracts.length === 0 ? (
                    <div className='text-center py-8 text-muted-foreground'>
                      <FileSignature className='h-10 w-10 mx-auto mb-3 opacity-30' />
                      <p className='text-sm'>No hay contratos activos disponibles.</p>
                      <div className='flex gap-2 justify-center mt-3'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => setTab('create-quick')}
                        >
                          Crear rápido
                        </Button>
                        <Button type='button' size='sm' onClick={() => setTab('create-full')}>
                          <Plus className='h-4 w-4 mr-1' /> Formulario completo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <p className='text-sm text-muted-foreground'>
                        Selecciona el contrato al que pertenece esta {contextLabel}:
                      </p>
                      <SearchableSelect
                        options={contracts.map(c => ({
                          value: c.id,
                          label: c.contractNumber ? `${c.contractNumber} — ${c.name}` : c.name,
                        }))}
                        value={value ?? ''}
                        onChange={handleLink}
                        placeholder='Buscar contrato...'
                        emptyLabel='Sin contratos disponibles'
                      />
                      <div className='space-y-1 max-h-64 overflow-y-auto'>
                        {contracts.map(c => (
                          <button
                            key={c.id}
                            type='button'
                            onClick={() => handleLink(c.id)}
                            className={`w-full text-left rounded-lg border px-3 py-2.5 hover:bg-muted/50 transition-colors ${
                              value === c.id ? 'border-primary bg-primary/5' : ''
                            }`}
                          >
                            <div className='flex items-center justify-between gap-2'>
                              <div className='min-w-0'>
                                <p className='text-sm font-medium truncate'>{c.name}</p>
                                <div className='flex items-center gap-2 mt-0.5'>
                                  {c.contractNumber && (
                                    <span className='text-xs text-muted-foreground font-mono'>
                                      {c.contractNumber}
                                    </span>
                                  )}
                                  {c.supplier && (
                                    <span className='text-xs text-muted-foreground'>
                                      {c.supplier.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Badge variant='outline' className='text-xs flex-shrink-0'>
                                {CONTRACT_CATEGORY_LABELS[c.category] ?? c.category}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value='create-quick' className='pt-4'>
                  <QuickContractForm
                    context={context}
                    prefill={resolvedPrefill}
                    supplierId={supplierId}
                    familyId={familyId}
                    onSuccess={handleCreated}
                    onCancel={() => setOpen(false)}
                  />
                </TabsContent>

                <TabsContent value='create-full' className='pt-4'>
                  <ContractForm
                    embedMode
                    prefill={resolvedPrefill}
                    onSuccess={handleCreated}
                    onCancel={() => setTab('link')}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
