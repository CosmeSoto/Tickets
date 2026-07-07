import { inlineSelectFeedback } from '../inline-select-feedback'
import { toast } from 'sonner'

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
  },
}))

describe('inlineSelectFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows selection toast with label and item name', () => {
    const feedback = inlineSelectFeedback('Modelo')
    feedback.onSelected({ id: '1', name: 'Dell Latitude 3550' })
    expect(toast.success).toHaveBeenCalledWith('Modelo seleccionado', {
      description: 'Dell Latitude 3550',
    })
  })

  it('shows create toast when item is new', () => {
    const feedback = inlineSelectFeedback('Bodega')
    feedback.onAfterSave({ id: '2', name: 'Bodega Principal' }, false)
    expect(toast.success).toHaveBeenCalledWith('Bodega creado', {
      description: 'Bodega Principal fue creado y seleccionado',
    })
  })

  it('shows update toast when item is edited', () => {
    const feedback = inlineSelectFeedback('Marca')
    feedback.onAfterSave({ id: '3', name: 'HP' }, true)
    expect(toast.success).toHaveBeenCalledWith('Marca actualizado', {
      description: 'HP fue actualizado exitosamente',
    })
  })
})
