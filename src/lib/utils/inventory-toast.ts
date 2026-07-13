import { toast as sonnerToast } from 'sonner'

type InventoryToastOptions = {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

function showInventoryToast({ title, description, variant }: InventoryToastOptions) {
  const opts = description ? { description } : undefined
  if (variant === 'destructive') {
    sonnerToast.error(title, opts)
  } else {
    sonnerToast.success(title, opts)
  }
}

/** Adaptador useToast → sonner para módulo inventario (migración gradual) */
export const inventoryToast = Object.assign(showInventoryToast, {
  error(title: string, description?: string) {
    showInventoryToast({ title, description, variant: 'destructive' })
  },
  success(title: string, description?: string) {
    showInventoryToast({ title, description })
  },
})
