'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CURRENCIES } from '@/lib/constants/currency-constants'

interface CurrencySelectProps {
  value: string
  onChange: (value: string) => void
  id?: string
  disabled?: boolean
  placeholder?: string
  /** Formato de la etiqueta dentro del trigger/lista. 'code' muestra solo "USD", 'full' muestra "USD — Dólar estadounidense". */
  labelStyle?: 'code' | 'full'
}

/**
 * Selector de moneda unificado — reemplaza las listas de <SelectItem> de
 * moneda que antes estaban duplicadas (y desincronizadas) en varios
 * formularios (contratos, facturas de equipo, ventas, proveedores).
 * Fuente de verdad de las monedas: src/lib/constants/currency-constants.ts
 */
export function CurrencySelect({
  value,
  onChange,
  id,
  disabled,
  placeholder = 'Seleccionar moneda',
  labelStyle = 'full',
}: CurrencySelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map(c => (
          <SelectItem key={c.code} value={c.code}>
            {labelStyle === 'code' ? c.code : c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
