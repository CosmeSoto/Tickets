import { toast } from 'sonner'
import type { InlineSelectOption } from '@/components/ui/inline-create-select'

/** Toasts consistentes al seleccionar o crear items en InlineCreateSelect */
export function inlineSelectFeedback(label: string) {
  return {
    onSelected: (item: InlineSelectOption) => {
      toast.success(`${label} seleccionado`, { description: item.name })
    },
    onAfterSave: (item: InlineSelectOption, isEdit: boolean) => {
      if (isEdit) {
        toast.success(`${label} actualizado`, {
          description: `${item.name} fue actualizado exitosamente`,
        })
      } else {
        toast.success(`${label} creado`, {
          description: `${item.name} fue creado y seleccionado`,
        })
      }
    },
  }
}
