'use client'

/**
 * AppDataProvider — Proveedor unificado de datos globales de la aplicación.
 *
 * Agrupa todos los contextos de datos que necesitan estar disponibles
 * globalmente para evitar peticiones redundantes:
 *   - FamiliesProvider: Familias de tickets e inventario
 *   - UsersProvider: Usuarios del sistema
 *   - DepartmentsProvider: Departamentos
 *
 * Uso:
 *   Envolver el layout raíz con este provider para que todos los componentes
 *   tengan acceso a los datos sin hacer peticiones HTTP adicionales.
 */

import React from 'react'
import { FamiliesProvider } from '@/contexts/families-context'
import { UsersProvider } from '@/contexts/users-context'
import { DepartmentsProvider } from '@/contexts/departments-context'

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  return (
    <FamiliesProvider>
      <UsersProvider>
        <DepartmentsProvider>
          {children}
        </DepartmentsProvider>
      </UsersProvider>
    </FamiliesProvider>
  )
}
