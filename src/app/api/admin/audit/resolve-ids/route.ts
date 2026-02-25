/**
 * API para resolver IDs (UUIDs) a nombres legibles en tiempo real
 * Usado para registros antiguos de auditoría que solo tienen IDs
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { IdResolverService } from '@/lib/services/id-resolver-service'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { values } = body

    if (!values || typeof values !== 'object') {
      return NextResponse.json(
        { error: 'Valores inválidos' },
        { status: 400 }
      )
    }

    // Resolver cada valor según su campo
    const resolved: Record<string, string> = {}
    
    for (const [fieldName, value] of Object.entries(values)) {
      if (value === null || value === undefined) {
        resolved[fieldName] = 'vacío'
        continue
      }

      // Si es booleano
      if (typeof value === 'boolean') {
        resolved[fieldName] = IdResolverService.getBooleanDisplayName(value)
        continue
      }

      // Si no es string, convertir a string
      if (typeof value !== 'string') {
        resolved[fieldName] = String(value)
        continue
      }

      // Traducir valores especiales
      const fieldLower = fieldName.toLowerCase()
      
      if (fieldLower === 'role') {
        resolved[fieldName] = IdResolverService.getRoleDisplayName(value)
        continue
      }
      
      if (fieldLower === 'status') {
        resolved[fieldName] = IdResolverService.getStatusDisplayName(value)
        continue
      }
      
      if (fieldLower === 'priority') {
        resolved[fieldName] = IdResolverService.getPriorityDisplayName(value)
        continue
      }

      // Si parece un UUID, intentar resolverlo
      if (value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        resolved[fieldName] = await IdResolverService.resolveFieldValue(fieldName, value)
      } else {
        resolved[fieldName] = value
      }
    }

    return NextResponse.json({
      success: true,
      resolved
    })

  } catch (error) {
    console.error('[API-AUDIT-RESOLVE] Error:', error)
    return NextResponse.json(
      { error: 'Error al resolver IDs' },
      { status: 500 }
    )
  }
}
