import { inventoryToast } from '../inventory-toast'
import { toast as sonnerToast } from 'sonner'

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

describe('inventoryToast', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('maps success toasts to sonner.success', () => {
    inventoryToast({ title: 'Guardado', description: 'OK' })
    expect(sonnerToast.success).toHaveBeenCalledWith('Guardado', { description: 'OK' })
    expect(sonnerToast.error).not.toHaveBeenCalled()
  })

  it('maps destructive toasts to sonner.error', () => {
    inventoryToast({ title: 'Error', description: 'Falló', variant: 'destructive' })
    expect(sonnerToast.error).toHaveBeenCalledWith('Error', { description: 'Falló' })
    expect(sonnerToast.success).not.toHaveBeenCalled()
  })

  it('omits description when not provided', () => {
    inventoryToast({ title: 'Listo' })
    expect(sonnerToast.success).toHaveBeenCalledWith('Listo', undefined)
  })
})
