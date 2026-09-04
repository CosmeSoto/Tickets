/**
 * GET  /api/inventory/suppliers/[id]/evaluations — historial de calificaciones de un proveedor
 * POST /api/inventory/suppliers/[id]/evaluations — registra una nueva calificación (solo ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { ZodError } from 'zod'
import {
  assertInventoryResourceRead,
  InventoryAccessError,
  toInventoryAccessUser,
  inventoryAccessToResponse,
} from '@/lib/inventory/inventory-resource-access'
import { sanitizeSupplierEvaluationPayload } from '@/lib/validations/inventory/supplier-evaluation'
import {
  computeTotal,
  classifyTotal,
  getSupplierQualificationThresholds,
} from '@/lib/inventory/supplier-qualification'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    try {
      await assertInventoryResourceRead(toInventoryAccessUser(session.user), 'SUPPLIER', id)
    } catch (err) {
      if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
      throw err
    }

    const evaluations = await prisma.supplier_evaluations.findMany({
      where: { supplierId: id },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      include: { evaluatedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json({ evaluations })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[GET /api/inventory/suppliers/[id]/evaluations]', err)
    return NextResponse.json({ error: 'Error al obtener las calificaciones' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (role !== 'ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador puede calificar proveedores' },
        { status: 403 }
      )
    }

    const { id } = await params
    const supplier = await prisma.suppliers.findUnique({ where: { id }, select: { id: true } })
    if (!supplier) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
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

    const evaluation = await prisma.supplier_evaluations.create({
      data: {
        ...data,
        supplierId: id,
        total,
        classification,
        evaluatedById: session.user.id,
      },
      include: { evaluatedBy: { select: { id: true, name: true } } },
    })

    return NextResponse.json(evaluation, { status: 201 })
  } catch (err) {
    if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
    console.error('[POST /api/inventory/suppliers/[id]/evaluations]', err)
    return NextResponse.json({ error: 'Error al registrar la calificación' }, { status: 500 })
  }
}
