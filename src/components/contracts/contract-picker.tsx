'use client'

/**
 * ContractPicker — selector de contrato embebido en formularios de activos/licencias.
 *
 * - Vincular existente (búsqueda)
 * - Crear contrato (formulario único completo, prellenado desde el activo)
 * - Completar/editar contrato vinculado sin salir del flujo
 */

import { useCallback, useMemo, useState } from 'react'
import { FileSignature, Plus, X, ExternalLink, Pencil, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { ContractForm } from '@/components/contracts/contract-form'
import type { Contract } from '@/types/contracts'
import { CONTRACT_CATEGORY_LABELS } from '@/types/contracts'
import {
  buildContractPrefill,
  type ContractPickerContext,
  type ContractPickerPrefill,
} from '@/lib/contracts/contract-picker-prefill'
import { FormDraftKeys } from '@/hooks/common/use-form-draft'

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
  /** Clave del borrador del formulario padre (licencia/equipo) para anidar el del contrato */
  draftParentKey?: string
  /**
   * Costo de renta de este activo al vincularlo a un contrato YA EXISTENTE (pestaña
   * "Vincular existente"). Se suma al costo del contrato al guardar — sin esto, el activo
   * quedaba vinculado sin afectar en nada el monto que se factura. No aplica al crear un
   * contrato nuevo junto con el activo (ese contrato ya define su costo total).
   */
  onLinkCost?: (cost: number | null) => void
}

type PickerTab = 'link' | 'create' | 'edit'

export function ContractPicker({
  value,
  onChange,
  supplierId,
  familyId,
  disabled,
  context = 'license',
  prefill = null,
  draftParentKey,
  onLinkCost,
}: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<PickerTab>('link')
  const [formDirty, setFormDirty] = useState(false)
  /** Contrato elegido en "Vincular existente", en espera de confirmar su costo. */
  const [pendingLinkContract, setPendingLinkContract] = useState<Contract | null>(null)
  const [pendingLinkCost, setPendingLinkCost] = useState('')

  const contractDraftKey = useMemo(() => {
    if (tab === 'edit' && value) return FormDraftKeys.contractEdit(value)
    const parent = draftParentKey || familyId || 'anon'
    return FormDraftKeys.contractEmbed(context, parent)
  }, [tab, value, draftParentKey, familyId, context])

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
    showErrorToast: false,
  })

  const { data: selectedContracts, reload: reloadSelected } = useFetch<Contract>(
    value ? `/api/inventory/contracts/${value}` : '/api/inventory/contracts',
    {
      enabled: !!value,
      transform: d => (d.id ? [d] : []),
      showErrorToast: false,
    }
  )
  const selectedContract = selectedContracts[0] ?? null

  const isFormTab = tab === 'create' || tab === 'edit'

  const confirmDiscard = useCallback(() => {
    if (!formDirty || !isFormTab) return true
    return window.confirm(
      'Hay cambios sin guardar en el contrato. ¿Cerrar y descartar lo que estabas llenando?'
    )
  }, [formDirty, isFormTab])

  const closePicker = useCallback(() => {
    if (!confirmDiscard()) return
    setFormDirty(false)
    setOpen(false)
  }, [confirmDiscard])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        setOpen(true)
        return
      }
      closePicker()
    },
    [closePicker]
  )

  const openPicker = (initialTab: PickerTab = 'link') => {
    setFormDirty(false)
    setTab(initialTab)
    setPendingLinkContract(null)
    setPendingLinkCost('')
    setOpen(true)
  }

  const handleLink = (contractId: string) => {
    onChange(contractId)
    setFormDirty(false)
    setOpen(false)
  }

  /** Paso 1: elegir contrato existente — pasa al paso 2 (confirmar costo) antes de vincular. */
  const selectContractToLink = (contractId: string) => {
    const contract = contracts.find(c => c.id === contractId)
    if (!contract) return
    setPendingLinkContract(contract)
    setPendingLinkCost('')
  }

  /** Paso 2: confirma el vínculo con el costo (opcional) que se suma al contrato. */
  const confirmPendingLink = () => {
    if (!pendingLinkContract) return
    const trimmed = pendingLinkCost.trim()
    const parsed = trimmed ? parseFloat(trimmed) : null
    onLinkCost?.(parsed != null && Number.isFinite(parsed) ? parsed : null)
    handleLink(pendingLinkContract.id)
    setPendingLinkContract(null)
    setPendingLinkCost('')
  }

  const cancelPendingLink = () => {
    setPendingLinkContract(null)
    setPendingLinkCost('')
  }

  const handleCreated = (contract: Contract) => {
    // Contrato NUEVO creado junto con este activo: su costo total ya lo define el propio
    // contrato, no hay nada que sumar — limpia cualquier costo que hubiera quedado
    // pendiente de un intento anterior de vincular a otro contrato existente.
    onLinkCost?.(null)
    onChange(contract.id)
    reload()
    reloadSelected()
    setFormDirty(false)
    setOpen(false)
  }

  const handleUpdated = (contract: Contract) => {
    onLinkCost?.(null)
    onChange(contract.id)
    reload()
    reloadSelected()
    setFormDirty(false)
    setOpen(false)
  }

  const handleClear = () => {
    onLinkCost?.(null)
    onChange(null)
  }

  const switchTab = (next: PickerTab) => {
    if (isFormTab && formDirty && next !== tab) {
      if (!confirmDiscard()) return
      setFormDirty(false)
    }
    setTab(next)
  }

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

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className='w-[min(98vw,90rem)] max-w-[90rem] h-[min(94vh,56rem)] max-h-[94vh] p-0 gap-0 overflow-hidden flex flex-col'
          onEscapeKeyDown={e => {
            if (isFormTab && formDirty) {
              e.preventDefault()
              closePicker()
            }
          }}
          onPointerDownOutside={e => {
            // Evita cerrar al click fuera mientras se edita/crea (pérdida de datos)
            if (isFormTab) e.preventDefault()
          }}
        >
          <DialogHeader className='px-6 pt-6 pb-3 border-b shrink-0'>
            <DialogTitle>
              {tab === 'edit' ? 'Completar contrato' : 'Gestionar contrato'}
            </DialogTitle>
            <DialogDescription>
              {tab === 'edit'
                ? 'Agrega facturación, líneas, custodio y adjuntos sin salir de la creación de la ' +
                  contextLabel +
                  '.'
                : `Vincula un contrato existente o créalo con los datos ya capturados de esta ${contextLabel}.`}
            </DialogDescription>
          </DialogHeader>

          <div className='overflow-y-auto flex-1 min-h-0 px-6 py-4'>
            {tab === 'edit' && selectedContract ? (
              <ContractForm
                contract={selectedContract}
                embedMode
                draftKey={contractDraftKey}
                onDirtyChange={setFormDirty}
                onSuccess={handleUpdated}
                onCancel={closePicker}
              />
            ) : (
              <Tabs value={tab} onValueChange={v => switchTab(v as PickerTab)}>
                <TabsList className='grid w-full grid-cols-2'>
                  <TabsTrigger value='link'>Vincular existente</TabsTrigger>
                  <TabsTrigger value='create'>Crear contrato</TabsTrigger>
                </TabsList>

                <TabsContent value='link' className='space-y-4 pt-4'>
                  {pendingLinkContract ? (
                    <div className='space-y-4'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='h-7 px-2 text-xs -ml-2'
                        onClick={cancelPendingLink}
                      >
                        <ArrowLeft className='h-3.5 w-3.5 mr-1' /> Elegir otro contrato
                      </Button>

                      <div className='rounded-lg border bg-muted/30 px-3 py-2.5'>
                        <p className='text-sm font-medium'>{pendingLinkContract.name}</p>
                        {pendingLinkContract.contractNumber && (
                          <p className='text-xs text-muted-foreground font-mono mt-0.5'>
                            {pendingLinkContract.contractNumber}
                          </p>
                        )}
                      </div>

                      <div className='space-y-1'>
                        <Label htmlFor='link-cost' className='text-xs'>
                          Costo de renta de esta {contextLabel} (opcional)
                        </Label>
                        <Input
                          id='link-cost'
                          type='number'
                          min='0'
                          step='0.01'
                          inputMode='decimal'
                          placeholder='0.00'
                          value={pendingLinkCost}
                          onChange={e => setPendingLinkCost(e.target.value)}
                        />
                        <p className='text-xs text-muted-foreground'>
                          Se suma al costo del contrato para que quede reflejado en sus próximas
                          cuotas. Déjalo vacío si ya está incluido en el costo actual del contrato.
                        </p>
                      </div>

                      <div className='flex justify-end gap-2'>
                        <Button type='button' variant='outline' onClick={cancelPendingLink}>
                          Cancelar
                        </Button>
                        <Button type='button' onClick={confirmPendingLink}>
                          Vincular contrato
                        </Button>
                      </div>
                    </div>
                  ) : contracts.length === 0 ? (
                    <div className='text-center py-10 text-muted-foreground'>
                      <FileSignature className='h-10 w-10 mx-auto mb-3 opacity-30' />
                      <p className='text-sm'>No hay contratos activos disponibles.</p>
                      <p className='text-xs mt-1 max-w-sm mx-auto'>
                        Crea un contrato con los datos de esta {contextLabel}; se vinculará al
                        guardar el activo.
                      </p>
                      <Button
                        type='button'
                        size='sm'
                        className='mt-4'
                        onClick={() => switchTab('create')}
                      >
                        <Plus className='h-4 w-4 mr-1' /> Crear contrato
                      </Button>
                    </div>
                  ) : (
                    <div className='space-y-2'>
                      <div className='flex items-center justify-between gap-2 flex-wrap'>
                        <p className='text-sm text-muted-foreground'>
                          Selecciona el contrato al que pertenece esta {contextLabel}:
                        </p>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => switchTab('create')}
                        >
                          <Plus className='h-4 w-4 mr-1' /> Nuevo contrato
                        </Button>
                      </div>
                      <SearchableSelect
                        options={contracts.map(c => ({
                          value: c.id,
                          label: c.contractNumber ? `${c.contractNumber} — ${c.name}` : c.name,
                        }))}
                        value={value ?? ''}
                        onChange={selectContractToLink}
                        placeholder='Buscar contrato...'
                        emptyLabel='Sin contratos disponibles'
                      />
                      <div className='space-y-1 max-h-[min(50vh,28rem)] overflow-y-auto'>
                        {contracts.map(c => (
                          <button
                            key={c.id}
                            type='button'
                            onClick={() => selectContractToLink(c.id)}
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

                <TabsContent value='create' className='pt-4'>
                  <ContractForm
                    embedMode
                    draftKey={contractDraftKey}
                    prefill={resolvedPrefill}
                    onDirtyChange={setFormDirty}
                    onSuccess={handleCreated}
                    onCancel={() => {
                      if (!confirmDiscard()) return
                      setFormDirty(false)
                      setTab('link')
                    }}
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
