import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assertCanManageProcesses,
  assertCanViewProcesses,
  getProcessAccess,
  isFamilyWithinProcessScope,
  assertOwnerCanOwnProcess,
} from '@/lib/processes/access'
import { validateProcessDiagramDefinition } from '@/lib/processes/diagram-definition'
import { getProcessModuleSettings } from '@/lib/processes/settings'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

const diagramSchema = z.object({
  type: z.enum(['SWIMLANE', 'SEQUENCE']),
  name: z.string().trim().min(1).max(150),
  definition: z.unknown(),
})
type DiagramInput = z.infer<typeof diagramSchema>

const createProcessSchema = z.object({
  code: z.string().trim().min(3).max(80),
  title: z.string().trim().min(3).max(250),
  objective: z.string().trim().max(5000).optional().nullable(),
  scope: z.string().trim().max(5000).optional().nullable(),
  level: z.number().int().min(0).max(10).default(1),
  parentProcessId: z.string().uuid().optional().nullable(),
  familyId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid(),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  /** Si se omite, se aplica `processes.defaultReviewMonths` de configuración. */
  reviewEveryMonths: z.number().int().min(1).max(60).optional(),
  content: z.record(z.unknown()).optional().nullable(),
  changeSummary: z.string().trim().max(2000).optional().nullable(),
  diagrams: z.array(diagramSchema).max(20).default([]),
})

const PROCESS_INCLUDE = {
  family: { select: { id: true, name: true, color: true } },
  department: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    take: 1,
    select: { id: true, versionNumber: true, createdAt: true, changeSummary: true },
  },
  _count: { select: { attachments: true, approvalEvents: true } },
  parentProcess: { select: { id: true, code: true, title: true, level: true } },
  childProcesses: { select: { id: true, code: true, title: true, level: true } },
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanViewProcesses(session.user.id, session.user.role)
  if (denied) return denied
  const access = await getProcessAccess(session.user.id, session.user.role)
  const { searchParams } = new URL(request.url)
  const requestedFamilyId = searchParams.get('familyId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()

  if (requestedFamilyId && !isFamilyWithinProcessScope(access, requestedFamilyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esa área.' }, { status: 403 })
  }

  const where: Record<string, unknown> = {}
  if (!access.canManage) where.status = 'PUBLISHED'
  else if (status) where.status = status
  if (requestedFamilyId) where.familyId = requestedFamilyId
  else if (access.familyIds) where.familyId = { in: access.familyIds }

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { title: { contains: search, mode: 'insensitive' } },
      { objective: { contains: search, mode: 'insensitive' } },
    ]
  }

  const processes = await (prisma as any).processes.findMany({
    where,
    include: PROCESS_INCLUDE,
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
  })
  return NextResponse.json({ processes })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied
  const access = await getProcessAccess(session.user.id, session.user.role)

  const parsed = createProcessSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de proceso inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data
  for (const diagram of data.diagrams) {
    const validation = validateProcessDiagramDefinition(diagram.definition)
    if (!validation.success) {
      return NextResponse.json({ error: validation.message }, { status: 400 })
    }
  }
  if (!isFamilyWithinProcessScope(access, data.familyId)) {
    return NextResponse.json({ error: 'No puedes crear procesos en esa área.' }, { status: 403 })
  }

  const [family, department, parentProcess, existing] = await Promise.all([
    prisma.families.findFirst({
      where: { id: data.familyId, isActive: true },
      select: { id: true },
    }),
    data.departmentId
      ? prisma.departments.findFirst({
          where: { id: data.departmentId, familyId: data.familyId, isActive: true },
          select: { id: true },
        })
      : Promise.resolve(null),
    data.parentProcessId
      ? (prisma as any).processes.findUnique({
          where: { id: data.parentProcessId },
          select: { id: true, familyId: true, level: true },
        })
      : Promise.resolve(null),
    (prisma as any).processes.findUnique({ where: { code: data.code }, select: { id: true } }),
  ])

  if (!family)
    return NextResponse.json({ error: 'El área seleccionada no está activa.' }, { status: 400 })
  if (data.departmentId && !department) {
    return NextResponse.json(
      { error: 'El departamento no pertenece al área seleccionada o está inactivo.' },
      { status: 400 }
    )
  }
  if (data.parentProcessId) {
    if (!parentProcess || parentProcess.familyId !== data.familyId) {
      return NextResponse.json(
        { error: 'El proceso padre debe existir y pertenecer a la misma área.' },
        { status: 400 }
      )
    }
    if (data.level !== parentProcess.level + 1) {
      return NextResponse.json(
        {
          error:
            'El nivel del proceso hijo debe ser exactamente un nivel mayor que su proceso padre.',
        },
        { status: 400 }
      )
    }
  } else if (data.level !== 0 && data.level !== 1) {
    return NextResponse.json(
      { error: 'Un proceso sin padre debe ser nivel 0 (macroproceso) o nivel 1.' },
      { status: 400 }
    )
  }
  const ownerError = await assertOwnerCanOwnProcess(data.ownerId, data.familyId)
  if (ownerError) return ownerError
  if (existing)
    return NextResponse.json({ error: 'El código de proceso ya existe.' }, { status: 409 })

  const moduleSettings = await getProcessModuleSettings()
  const reviewEveryMonths = data.reviewEveryMonths ?? moduleSettings.defaultReviewMonths

  const process = await (prisma as any).$transaction(async (tx: any) => {
    const created = await tx.processes.create({
      data: {
        code: data.code,
        title: data.title,
        objective: data.objective || null,
        scope: data.scope || null,
        level: data.level,
        parentProcessId: data.parentProcessId || null,
        familyId: data.familyId,
        departmentId: data.departmentId || null,
        ownerId: data.ownerId,
        createdById: session.user.id,
        criticality: data.criticality,
        reviewEveryMonths,
      },
    })
    await tx.process_versions.create({
      data: {
        processId: created.id,
        versionNumber: 1,
        content: data.content || undefined,
        changeSummary: data.changeSummary || 'Versión inicial',
        createdById: session.user.id,
        diagrams: data.diagrams.length
          ? {
              create: data.diagrams.map((diagram: DiagramInput) => ({
                type: diagram.type,
                name: diagram.name,
                definition: diagram.definition,
              })),
            }
          : undefined,
      },
    })
    await tx.process_approval_events.create({
      data: {
        processId: created.id,
        toStatus: 'DRAFT',
        notes: 'Proceso creado.',
        actorId: session.user.id,
      },
    })
    return tx.processes.findUnique({ where: { id: created.id }, include: PROCESS_INCLUDE })
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.PROCESS_CREATED,
    entityType: 'process',
    entityId: process.id,
    userId: session.user.id,
    newValues: {
      code: process.code,
      title: process.title,
      familyId: process.familyId,
      departmentId: process.departmentId,
      ownerId: process.ownerId,
      criticality: process.criticality,
    },
    details: { source: 'processes_module', versionNumber: 1, diagrams: data.diagrams.length },
    request,
  })

  return NextResponse.json({ process }, { status: 201 })
}
