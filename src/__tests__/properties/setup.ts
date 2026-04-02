import * as fc from 'fast-check'

// Configuración global para Property-Based Testing
// Feature: multi-family-ticket-system
fc.configureGlobal({
  numRuns: 100,
  verbose: true,
})
