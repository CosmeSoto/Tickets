import { allRequiredCheckpointsVisited } from '@/lib/patrol/patrol-finalize'
import { calculateCompletionPercentage } from '@/lib/patrol/patrol-completion'

describe('patrol finalize helpers', () => {
  it('allRequiredCheckpointsVisited exige al menos 1 requerido', () => {
    expect(allRequiredCheckpointsVisited(0, 0)).toBe(false)
    expect(allRequiredCheckpointsVisited(3, 2)).toBe(false)
    expect(allRequiredCheckpointsVisited(3, 3)).toBe(true)
    expect(allRequiredCheckpointsVisited(3, 4)).toBe(true)
  })

  it('completion 100% alineado con auto-cierre', () => {
    expect(calculateCompletionPercentage(6, 6)).toBe(100)
    expect(allRequiredCheckpointsVisited(6, 6)).toBe(true)
  })
})
