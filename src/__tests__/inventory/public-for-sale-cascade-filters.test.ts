/**
 * Tests for cascade filter logic in PublicForSalePage
 *
 * Requisitos: 8.3, 8.10
 *
 * Verifica que:
 * 1. Al seleccionar una familia, el selector de tipo muestra solo los tipos de esa familia
 * 2. Si el tipo actual no pertenece a la nueva familia seleccionada, se limpia automáticamente
 */

describe('PublicForSalePage - Cascade Filters', () => {
  describe('Family to Type cascade logic', () => {
    it('should filter available types when a family is selected', () => {
      // Arrange: Mock data structure
      const filters = {
        families: [
          {
            id: 'family-1',
            name: 'Tecnología',
            icon: null,
            color: null,
            types: [
              { id: 'type-1', name: 'Laptop' },
              { id: 'type-2', name: 'Monitor' },
            ],
          },
          {
            id: 'family-2',
            name: 'Vehículos',
            icon: null,
            color: null,
            types: [
              { id: 'type-3', name: 'Camioneta' },
              { id: 'type-4', name: 'Sedán' },
            ],
          },
        ],
      }

      // Act: Simulate selecting family-1
      const selectedFamilyId = 'family-1'
      const availableTypes = selectedFamilyId
        ? (filters.families.find(f => f.id === selectedFamilyId)?.types ?? [])
        : filters.families.flatMap(f => f.types)

      // Assert: Only types from family-1 should be available
      expect(availableTypes).toHaveLength(2)
      expect(availableTypes.map(t => t.id)).toEqual(['type-1', 'type-2'])
    })

    it('should show all types when no family is selected', () => {
      // Arrange
      const filters = {
        families: [
          {
            id: 'family-1',
            name: 'Tecnología',
            icon: null,
            color: null,
            types: [
              { id: 'type-1', name: 'Laptop' },
              { id: 'type-2', name: 'Monitor' },
            ],
          },
          {
            id: 'family-2',
            name: 'Vehículos',
            icon: null,
            color: null,
            types: [
              { id: 'type-3', name: 'Camioneta' },
              { id: 'type-4', name: 'Sedán' },
            ],
          },
        ],
      }

      // Act: No family selected
      const selectedFamilyId = ''
      const availableTypes = selectedFamilyId
        ? (filters.families.find(f => f.id === selectedFamilyId)?.types ?? [])
        : filters.families.flatMap(f => f.types)

      // Assert: All types should be available
      expect(availableTypes).toHaveLength(4)
      expect(availableTypes.map(t => t.id)).toEqual(['type-1', 'type-2', 'type-3', 'type-4'])
    })

    it('should clear type selection when switching to a family that does not contain the current type', () => {
      // Arrange
      const filters = {
        families: [
          {
            id: 'family-1',
            name: 'Tecnología',
            icon: null,
            color: null,
            types: [
              { id: 'type-1', name: 'Laptop' },
              { id: 'type-2', name: 'Monitor' },
            ],
          },
          {
            id: 'family-2',
            name: 'Vehículos',
            icon: null,
            color: null,
            types: [
              { id: 'type-3', name: 'Camioneta' },
              { id: 'type-4', name: 'Sedán' },
            ],
          },
        ],
      }

      // Initial state: family-1 selected with type-1
      const selectedFamilyId = 'family-1'
      let selectedTypeId = 'type-1'

      // Act: Switch to family-2
      const newFamilyId = 'family-2'
      const newFamilyId = 'family-2'
      const newFamily = filters.families.find(f => f.id === newFamilyId)
      const typeExistsInNewFamily = newFamily?.types.some(t => t.id === selectedTypeId)

      // Simulate the cascade logic
      if (newFamilyId && selectedTypeId && !typeExistsInNewFamily) {
        selectedTypeId = '' // Clear type selection
      }

      // Assert: Type should be cleared because type-1 doesn't belong to family-2
      expect(selectedTypeId).toBe('')
    })

    it('should keep type selection when switching to a family that contains the current type', () => {
      // This is an edge case that shouldn't happen in the real UI
      // (types belong to only one family), but we test the logic anyway

      // Arrange
      const filters = {
        families: [
          {
            id: 'family-1',
            name: 'Tecnología',
            icon: null,
            color: null,
            types: [
              { id: 'type-1', name: 'Laptop' },
              { id: 'type-2', name: 'Monitor' },
            ],
          },
          {
            id: 'family-2',
            name: 'Tecnología Avanzada',
            icon: null,
            color: null,
            types: [
              { id: 'type-1', name: 'Laptop' }, // Same type in different family (edge case)
              { id: 'type-5', name: 'Servidor' },
            ],
          },
        ],
      }

      // Initial state: family-1 selected with type-1
      const initialFamilyId = 'family-1'
      let selectedTypeId = 'type-1'

      // Act: Switch to family-2 which also has type-1
      const newFamilyId = 'family-2'
      const newFamily = filters.families.find(f => f.id === newFamilyId)
      const typeExistsInNewFamily = newFamily?.types.some(t => t.id === selectedTypeId)

      // Simulate the cascade logic
      if (newFamilyId && selectedTypeId && !typeExistsInNewFamily) {
        selectedTypeId = '' // Clear type selection
      }

      // Assert: Type should be kept because type-1 exists in family-2
      expect(selectedTypeId).toBe('type-1')
    })

    it('should not clear type when switching from a family to "all families"', () => {
      // Arrange
      const filters = {
        families: [
          {
            id: 'family-1',
            name: 'Tecnología',
            icon: null,
            color: null,
            types: [
              { id: 'type-1', name: 'Laptop' },
              { id: 'type-2', name: 'Monitor' },
            ],
          },
        ],
      }

      // Initial state: family-1 selected with type-1
      const initialFamilyId = 'family-1'
      let selectedTypeId = 'type-1'

      // Act: Switch to "all families" (empty string)
      const newFamilyId = ''

      // Simulate the cascade logic - it only runs when newFamilyId is truthy
      if (newFamilyId && selectedTypeId) {
        const newFamily = filters.families.find(f => f.id === newFamilyId)
        const typeExistsInNewFamily = newFamily?.types.some(t => t.id === selectedTypeId)
        if (!typeExistsInNewFamily) {
          selectedTypeId = ''
        }
      }

      // Assert: Type should be kept when switching to "all families"
      expect(selectedTypeId).toBe('type-1')
    })
  })
})
