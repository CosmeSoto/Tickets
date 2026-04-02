'use client'

/**
 * SectionTable y HelpTip — componentes reutilizables extraídos de /inventory/families/page.tsx
 * Usados en TabInventario para mostrar/editar secciones visibles y obligatorias.
 */

import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import type { FormSection } from '@/lib/inventory/family-config-types'

export const SECTION_LABELS: Record<FormSection, string> = {
  FINANCIAL: 'Financiero',
  DEPRECIATION: 'Depreciación',
  CONTRACT: 'Contrato',
  STOCK_MRO: 'Stock MRO',
  WAREHOUSE: 'Bodega',
}

export const SECTION_DESCRIPTIONS: Record<FormSection, string> = {
  FINANCIAL: 'Precio de compra, fecha de compra, N° de factura',
  DEPRECIATION: 'Método, vida útil en años, valor residual',
  CONTRACT: 'Número de contrato, fechas de inicio/fin, costo mensual',
  STOCK_MRO: 'Stock inicial, stock mínimo, stock máximo',
  WAREHOUSE: 'Bodega de almacenamiento del activo',
}

/** Tooltip de ayuda reutilizable */
export function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px] text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Tabla reutilizable de secciones visible/obligatoria */
export function SectionTable({
  sections,
  visible,
  required,
  onToggleVisible,
  onToggleRequired,
  disabled,
}: {
  sections: FormSection[]
  visible: FormSection[]
  required: FormSection[]
  onToggleVisible: (s: FormSection, v: boolean) => void
  onToggleRequired: (s: FormSection, v: boolean) => void
  disabled?: boolean
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left py-2 font-medium text-muted-foreground">Sección</th>
          <th className="text-left py-2 font-medium text-muted-foreground hidden sm:table-cell">
            Campos incluidos
          </th>
          <th className="text-center py-2 font-medium text-muted-foreground w-20">
            <span className="flex items-center justify-center gap-1">
              Visible
              <HelpTip text="El usuario verá esta sección en el formulario, pero no es obligatorio completarla." />
            </span>
          </th>
          <th className="text-center py-2 font-medium text-muted-foreground w-24">
            <span className="flex items-center justify-center gap-1">
              Obligatoria
              <HelpTip text="El usuario debe completar esta sección para poder guardar el activo. Activar esto también activa Visible." />
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        {sections.map((section) => (
          <tr key={section} className="border-b last:border-0 hover:bg-muted/30">
            <td className="py-2.5 font-medium">{SECTION_LABELS[section]}</td>
            <td className="py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
              {SECTION_DESCRIPTIONS[section]}
            </td>
            <td className="py-2.5 text-center">
              <Checkbox
                checked={visible.includes(section)}
                onCheckedChange={(checked) => onToggleVisible(section, !!checked)}
                disabled={disabled}
              />
            </td>
            <td className="py-2.5 text-center">
              <Checkbox
                checked={required.includes(section)}
                onCheckedChange={(checked) => onToggleRequired(section, !!checked)}
                disabled={disabled}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
