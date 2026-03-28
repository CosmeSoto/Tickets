'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'

export interface ContractData {
  action: 'create' | 'link'
  contractId?: string
  contractNumber?: string
  startDate?: string
  endDate?: string
  monthlyCost?: number
}

interface ExistingContract {
  id: string
  contractNumber: string | null
  name: string
}

interface ContractSectionProps {
  acquisitionMode: 'RENTAL' | 'LOAN'
  supplierId: string | null
  onContractChange: (contract: ContractData | null) => void
}

export function ContractSection({
  acquisitionMode,
  supplierId,
  onContractChange,
}: ContractSectionProps) {
  const [action, setAction] = useState<'create' | 'link' | null>(null)

  // Campos para "crear contrato nuevo"
  const [contractNumber, setContractNumber] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [monthlyCost, setMonthlyCost] = useState('')

  // Campos para "asociar a contrato existente"
  const [existingContracts, setExistingContracts] = useState<ExistingContract[]>([])
  const [selectedContractId, setSelectedContractId] = useState('')
  const [loadingContracts, setLoadingContracts] = useState(false)

  // Cargar contratos existentes cuando se selecciona la opción "link"
  useEffect(() => {
    if (action !== 'link') return

    const fetchContracts = async () => {
      setLoadingContracts(true)
      try {
        const params = new URLSearchParams({ isActive: 'true' })
        if (supplierId) params.set('supplierId', supplierId)
        const res = await fetch(`/api/inventory/licenses?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setExistingContracts(data.licenses ?? data.items ?? [])
        }
      } finally {
        setLoadingContracts(false)
      }
    }

    fetchContracts()
  }, [action, supplierId])

  // Notificar cambios al padre
  useEffect(() => {
    if (action === null) {
      onContractChange(null)
      return
    }

    if (action === 'create') {
      if (!contractNumber || !startDate || !endDate) {
        onContractChange(null)
        return
      }
      if (acquisitionMode === 'RENTAL' && !monthlyCost) {
        onContractChange(null)
        return
      }
      const data: ContractData = {
        action: 'create',
        contractNumber,
        startDate,
        endDate,
      }
      if (acquisitionMode === 'RENTAL') {
        data.monthlyCost = parseFloat(monthlyCost)
      }
      onContractChange(data)
      return
    }

    if (action === 'link') {
      if (!selectedContractId) {
        onContractChange(null)
        return
      }
      onContractChange({ action: 'link', contractId: selectedContractId })
    }
  }, [action, contractNumber, startDate, endDate, monthlyCost, selectedContractId, acquisitionMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleActionChange = (newAction: 'create' | 'link') => {
    setAction(newAction)
    // Resetear campos al cambiar opción
    setContractNumber('')
    setStartDate('')
    setEndDate('')
    setMonthlyCost('')
    setSelectedContractId('')
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">Contrato</p>

      {/* RadioGroup manual */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="contract-action"
            value="create"
            checked={action === 'create'}
            onChange={() => handleActionChange('create')}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-sm">Crear contrato nuevo</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="contract-action"
            value="link"
            checked={action === 'link'}
            onChange={() => handleActionChange('link')}
            className="h-4 w-4 accent-blue-600"
          />
          <span className="text-sm">Asociar a contrato existente</span>
        </label>
      </div>

      {/* Opción A: Crear contrato nuevo */}
      {action === 'create' && (
        <div className="space-y-3 pl-6 border-l-2 border-border">
          <div className="space-y-1">
            <Label htmlFor="contractNumber">
              Número de contrato <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contractNumber"
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              placeholder="Ej: CONT-2024-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="endDate">
                Fecha de fin <span className="text-destructive">*</span>
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {acquisitionMode === 'RENTAL' && (
            <div className="space-y-1">
              <Label htmlFor="monthlyCost">
                Costo mensual <span className="text-destructive">*</span>
              </Label>
              <Input
                id="monthlyCost"
                type="number"
                min="0"
                step="0.01"
                value={monthlyCost}
                onChange={(e) => setMonthlyCost(e.target.value)}
                placeholder="0.00"
              />
            </div>
          )}
        </div>
      )}

      {/* Opción B: Asociar a contrato existente */}
      {action === 'link' && (
        <div className="space-y-1 pl-6 border-l-2 border-border">
          <Label htmlFor="existingContract">
            Contrato existente <span className="text-destructive">*</span>
          </Label>
          {loadingContracts ? (
            <p className="text-sm text-muted-foreground">Cargando contratos...</p>
          ) : (
            <SearchableSelect
              id="existingContract"
              options={existingContracts.map(c => ({ value: c.id, label: c.contractNumber ?? c.name }))}
              value={selectedContractId}
              onChange={setSelectedContractId}
              placeholder="Buscar contrato..."
              emptyLabel="Seleccionar contrato..."
            />
          )}
          {!loadingContracts && existingContracts.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No hay contratos activos disponibles{supplierId ? ' para este proveedor' : ''}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
