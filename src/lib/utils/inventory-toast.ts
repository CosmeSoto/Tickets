import { toast as sonnerToast } from 'sonner'

type InventoryToastOptions = {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

/** Adaptador useToast → sonner para módulo inventario (migración gradual) */
export function inventoryToast({ title, description, variant }: InventoryToastOptions) {
  const opts = description ? { description } : undefined
  if (variant === 'destructive') {
    sonnerToast.error(title, opts)
  } else {
    sonnerToast.success(title, opts)
  }
}
