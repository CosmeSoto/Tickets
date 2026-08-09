/**
 * Legacy alias — redirige a la API canónica.
 * Preferir: /api/inventory/family-config/[familyId]
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  GET as canonicalGet,
  PUT as canonicalPut,
} from '@/app/api/inventory/family-config/[familyId]/route'

type LegacyContext = { params: Promise<{ id: string }> }

function toCanonicalContext(params: Promise<{ id: string }>) {
  return {
    params: params.then(({ id }) => ({ familyId: id })),
  }
}

/** @deprecated Use GET /api/inventory/family-config/[familyId] */
export async function GET(request: NextRequest, { params }: LegacyContext) {
  return canonicalGet(request, toCanonicalContext(params))
}

/** @deprecated Use PUT /api/inventory/family-config/[familyId] */
export async function PUT(request: NextRequest, { params }: LegacyContext) {
  return canonicalPut(request, toCanonicalContext(params))
}
