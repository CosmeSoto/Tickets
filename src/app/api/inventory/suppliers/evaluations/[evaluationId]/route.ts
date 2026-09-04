/**
 * PATCH  /api/inventory/suppliers/evaluations/[evaluationId] — edita una calificación (solo ADMIN)
 * DELETE /api/inventory/suppliers/evaluations/[evaluationId] — elimina una calificación (solo ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ZodError } from 'zod'
import { sanitizeSupplierEvaluationPayload } from '@/lib/validations/inventory/supplier-evaluation'
import {
  computeTotal,
  classifyTotal,
  getSupplierQualificationThresholds,
} from '@/lib/inventory/supplier-qualification'

type RouteContext = { params: Promise<{ evaluationId: string }> }

function assertAdmin(session: { user: { role: string; isSuperAdmin?: boolean } }) {
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  return session.user.role === 'ADMIN' || isSuperAdmin
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!assertAdmin(session as any)) {
      return NextResponse.json(
        { error: 'Solo el administrador puede calificar proveedores' },
        { status: 403 }
      )
    }

    const { evaluationId } = await params
    const existing = await prisma.supplier_evaluations.findUnique({ where: { id: evaluationId } })
    if (!existing) {
      return NextResponse.json({ error: 'Calificación no encontrada' }, { status: 404 })
    }

    const body = await request.json()
    let data: ReturnType<typeof sanitizeSupplierEvaluationPayload>
    try {
      data = sanitizeSupplierEvaluationPayload(body)
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.errors[0]
        return NextResponse.json(
          { error: first?.message ?? 'Datos inválidos', field: first?.path?.join('.') },
          { status: 422 }
        )
      }
      throw err
    }

    const thresholds = await getSupplierQualificationThresholds()
    const total = computeTotal(data)
    const classification = classifyTotal(total, thresholds)

    const evaluation = await prisma.supplier_evaluations.update({
      where: { id: evaluationId },
      data: { ...data, total, classification },
      include: { evaluatedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(evaluation)
  } catch (err) {
    console.error('[PATCH /api/inventory/suppliers/evaluations/[evaluationId]]', err)
    return NextResponse.json({ error: 'Error al actualizar la calificación' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    if (!assertAdmin(session as any)) {
      return NextResponse.json(
        { error: 'Solo el administrador puede eliminar calificaciones' },
        { status: 403 }
      )
    }

    const { evaluationId } = await params
    const existing = await prisma.supplier_evaluations.findUnique({ where: { id: evaluationId } })
    if (!existing) {
      return NextResponse.json({ error: 'Calificación no encontrada' }, { status: 404 })
    }

    await prisma.supplier_evaluations.delete({ where: { id: evaluationId } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/inventory/suppliers/evaluations/[evaluationId]]', err)
    return NextResponse.json({ error: 'Error al eliminar la calificación' }, { status: 500 })
  }
}
