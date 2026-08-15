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
  sanitizeProcessAttachment,
  assertOwnerCanOwnProcess,
} from '@/lib/processes/access'
import { validateProcessDiagramDefinition } from '@/lib/processes/diagram-definition'
import { getProcessModuleSettings } from '@/lib/processes/settings'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

function serializeProcessForClient(process: any, canManage: boolean) {
  const versions = canManage
    ? process.versions
    : process.versions.slice(0, 1).map((version: any) => ({
        ...version,
        // Lectores del portal solo ven el snapshot publicado (última versión).
        externalReviews: undefined,
      }))

  return {
    ...process,
    versions,
    attachments: (process.attachments || []).map((attachment: any) =>
      sanitizeProcessAttachment(attachment)
    ),
  }
}

const diagramSchema = z.object({
  type: z.enum(['SWIMLANE', 'SEQUENCE']),
  name: z.string().trim().min(1).max(150),
  definition: z.unknown(),
})
type DiagramInput = z.infer<typeof diagramSchema>

const updateProcessSchema = z.object({
  title: z.string().trim().min(3).max(250).optional(),
  objective: z.string().trim().max(5000).nullable().optional(),
  scope: z.string().trim().max(5000).nullable().optional(),
  level: z.number().int().min(0).max(10).optional(),
  parentProcessId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  ownerId: z.string().uuid().optional(),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  reviewEveryMonths: z.number().int().min(1).max(60).optional(),
  content: z.record(z.unknown()).nullable().optional(),
  changeSummary: z.string().trim().max(2000).optional(),
  diagrams: z.array(diagramSchema).max(20).optional(),
})

const transitionSchema = z.object({
  status: z.enum([
    'DRAFT',
    'PENDING_AREA_REVIEW',
    'PENDING_EXTERNAL_DPD',
    'PUBLISHED',
    'REJECTED',
    'OBSOLETE',
  ]),
  notes: z.string().trim().max(2000).optional(),
})

const PROCESS_DETAIL_INCLUDE = {
  family: { select: { id: true, name: true, color: true } },
  parentProcess: { select: { id: true, code: true, title: true, level: true } },
  childProcesses: { select: { id: true, code: true, title: true, level: true } },
  department: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    include: {
      createdBy: { select: { id: true, name: true } },
      diagrams: true,
      externalReviews: {
        include: { recordedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' as const },
      },
    },
  },
  attachments: { orderBy: { createdAt: 'desc' as const } },
  approvalEvents: {
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' as const },
  },
}

function canTransition(from: string, to: string): boolean {
  const transitions: Record<string, string[]> = {
    DRAFT: ['PENDING_AREA_REVIEW'],
    // Publicación directa tras revisión de área sigue permitida para procedimientos
    // sin datos personales. El camino DPD usa PENDING_EXTERNAL_DPD y exige evidencia.
    PENDING_AREA_REVIEW: ['PENDING_EXTERNAL_DPD', 'PUBLISHED', 'REJECTED'],
    PENDING_EXTERNAL_DPD: ['PUBLISHED', 'REJECTED'],
    PUBLISHED: ['DRAFT', 'OBSOLETE'],
    REJECTED: ['DRAFT'],
    OBSOLETE: [],
  }
  return transitions[from]?.includes(to) ?? false
}

async function assertExternalReviewBeforePublish(
  processId: string,
  fromStatus: string,
  toStatus: string
) {
  if (toStatus !== 'PUBLISHED' || fromStatus !== 'PENDING_EXTERNAL_DPD') return null
  const latestVersion = await (prisma as any).process_versions.findFirst({
    where: { processId },
    orderBy: { versionNumber: 'desc' },
    select: {
      id: true,
      externalReviews: {
        where: {
          status: 'REVIEWED',
          evidencePath: { not: null },
        },
        select: { id: true, evidencePath: true },
        take: 1,
      },
    },
  })
  if (!latestVersion?.externalReviews?.length) {
    return NextResponse.json(
      {
        error:
          'Para publicar tras revisión externa debe registrar evidencia DPD REVIEWED con archivo o referencia persistida.',
      },
      { status: 422 }
    )
  }
  return null
}

async function mustUseExternalDpdForCritical(): Promise<boolean> {
  const settings = await getProcessModuleSettings()
  return settings.requireExternalDpdForCritical
}

async function loadAuthorizedProcess(
  id: string,
  userId: string,
  role: string,
  forManagement = false
) {
  const access = await getProcessAccess(userId, role)
  const process = await (prisma as any).processes.findUnique({
    where: { id },
    include: PROCESS_DETAIL_INCLUDE,
  })
  if (!process) return { access, process: null }
  if (!isFamilyWithinProcessScope(access, process.familyId)) return { access, process: null }
  if (!forManagement && !access.canManage && process.status !== 'PUBLISHED') {
    return { access, process: null }
  }
  return { access, process }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanViewProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id } = await params
  const { access, process } = await loadAuthorizedProcess(id, session.user.id, session.user.role)
  if (!process) return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })
  return NextResponse.json({ process: serializeProcessForClient(process, access.canManage) })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id } = await params
  const { process } = await loadAuthorizedProcess(id, session.user.id, session.user.role, true)
  if (!process) return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })

  const body = await request.json()
  const transition = transitionSchema.safeParse(body)
  if (transition.success && Object.keys(body).every(key => ['status', 'notes'].includes(key))) {
    if (
      transition.data.status === 'PUBLISHED' &&
      process.status === 'PENDING_AREA_REVIEW' &&
      process.criticality === 'CRITICAL' &&
      (await mustUseExternalDpdForCritical())
    ) {
      return NextResponse.json(
        {
          error:
            'La configuración exige revisión DPD externa para procesos críticos. Envíalo primero a revisión externa.',
        },
        { status: 422 }
      )
    }
    if (!canTransition(process.status, transition.data.status)) {
      return NextResponse.json(
        { error: `No se permite cambiar de ${process.status} a ${transition.data.status}.` },
        { status: 422 }
      )
    }
    const reviewBlock = await assertExternalReviewBeforePublish(
      id,
      process.status,
      transition.data.status
    )
    if (reviewBlock) return reviewBlock

    const now = new Date()
    let nextReviewAt = process.nextReviewAt as Date | null
    if (transition.data.status === 'PUBLISHED') {
      nextReviewAt = new Date(now.getTime())
      nextReviewAt.setMonth(nextReviewAt.getMonth() + process.reviewEveryMonths)
    }
    const updated = await (prisma as any).$transaction(async (tx: any) => {
      const record = await tx.processes.update({
        where: { id },
        data: {
          status: transition.data.status,
          publishedAt: transition.data.status === 'PUBLISHED' ? now : process.publishedAt,
          nextReviewAt:
            transition.data.status === 'PUBLISHED' ? nextReviewAt : process.nextReviewAt,
          ...(transition.data.status === 'PUBLISHED' ? { lastReviewReminderAt: null } : {}),
        },
      })
      await tx.process_approval_events.create({
        data: {
          processId: id,
          fromStatus: process.status,
          toStatus: transition.data.status,
          notes: transition.data.notes || null,
          actorId: session.user.id,
        },
      })
      return record
    })
    await AuditServiceComplete.log({
      action: AuditActionsComplete.PROCESS_STATUS_CHANGED,
      entityType: 'process',
      entityId: id,
      userId: session.user.id,
      oldValues: { status: process.status },
      newValues: { status: updated.status },
      details: { notes: transition.data.notes || null, source: 'processes_module' },
      request,
    })
    const owner = await prisma.users.findUnique({
      where: { id: process.ownerId },
      select: { id: true, name: true, email: true },
    })
    if (owner) {
      const { notifyProcessStatusChange } = await import('@/lib/processes/notifications')
      void notifyProcessStatusChange({
        processId: id,
        code: process.code,
        title: process.title,
        status: updated.status,
        owner,
        actorId: session.user.id,
      })
    }
    return NextResponse.json({ process: updated })
  }

  const parsed = updateProcessSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos de proceso inválidos.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const data = parsed.data
  for (const diagram of data.diagrams ?? []) {
    const validation = validateProcessDiagramDefinition(diagram.definition)
    if (!validation.success) {
      return NextResponse.json({ error: validation.message }, { status: 400 })
    }
  }
  if (data.departmentId !== undefined && data.departmentId !== null) {
    const department = await prisma.departments.findFirst({
      where: { id: data.departmentId, familyId: process.familyId, isActive: true },
      select: { id: true },
    })
    if (!department) {
      return NextResponse.json(
        { error: 'El departamento no pertenece al área del proceso o está inactivo.' },
        { status: 400 }
      )
    }
  }
  if (data.parentProcessId !== undefined || data.level !== undefined) {
    const nextParentId =
      data.parentProcessId !== undefined ? data.parentProcessId : process.parentProcessId
    const nextLevel = data.level !== undefined ? data.level : process.level
    if (nextParentId === id) {
      return NextResponse.json(
        { error: 'Un proceso no puede ser su propio padre.' },
        { status: 400 }
      )
    }
    if (nextParentId) {
      const parent = await (prisma as any).processes.findUnique({
        where: { id: nextParentId },
        select: { id: true, familyId: true, level: true },
      })
      if (!parent || parent.familyId !== process.familyId || nextLevel !== parent.level + 1) {
        return NextResponse.json(
          { error: 'El proceso padre debe ser de la misma área y estar un nivel por encima.' },
          { status: 400 }
        )
      }
    } else if (nextLevel !== 0 && nextLevel !== 1) {
      return NextResponse.json(
        { error: 'Un proceso sin padre debe ser nivel 0 (macroproceso) o nivel 1.' },
        { status: 400 }
      )
    }
  }
  if (data.ownerId) {
    const ownerError = await assertOwnerCanOwnProcess(data.ownerId, process.familyId)
    if (ownerError) return ownerError
  }

  const hasVersionPayload = data.content !== undefined || data.diagrams !== undefined
  const mustReturnToDraft =
    hasVersionPayload &&
    (process.status === 'PUBLISHED' ||
      process.status === 'PENDING_AREA_REVIEW' ||
      process.status === 'PENDING_EXTERNAL_DPD')

  const updated = await (prisma as any).$transaction(async (tx: any) => {
    const record = await tx.processes.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.objective !== undefined ? { objective: data.objective || null } : {}),
        ...(data.scope !== undefined ? { scope: data.scope || null } : {}),
        ...(data.level !== undefined ? { level: data.level } : {}),
        ...(data.parentProcessId !== undefined ? { parentProcessId: data.parentProcessId } : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
        ...(data.ownerId !== undefined ? { ownerId: data.ownerId } : {}),
        ...(data.criticality !== undefined ? { criticality: data.criticality } : {}),
        ...(data.reviewEveryMonths !== undefined
          ? { reviewEveryMonths: data.reviewEveryMonths }
          : {}),
        ...(hasVersionPayload ? { lastReviewReminderAt: null } : {}),
        ...(mustReturnToDraft ? { status: 'DRAFT', publishedAt: null, nextReviewAt: null } : {}),
      },
    })
    if (hasVersionPayload) {
      const latest = process.versions[0]
      const diagramsToCreate =
        data.diagrams !== undefined
          ? data.diagrams
          : (latest?.diagrams || []).map(
              (diagram: DiagramInput & { type: string; name: string; definition: unknown }) => ({
                type: diagram.type,
                name: diagram.name,
                definition: diagram.definition,
              })
            )
      await tx.process_versions.create({
        data: {
          processId: id,
          versionNumber: (latest?.versionNumber || 0) + 1,
          content:
            data.content === undefined ? latest?.content || undefined : data.content || undefined,
          changeSummary: data.changeSummary || 'Actualización del procedimiento',
          createdById: session.user.id,
          diagrams: diagramsToCreate.length
            ? {
                create: diagramsToCreate.map((diagram: DiagramInput) => ({
                  type: diagram.type,
                  name: diagram.name,
                  definition: diagram.definition,
                })),
              }
            : undefined,
        },
      })
    }
    if (mustReturnToDraft) {
      await tx.process_approval_events.create({
        data: {
          processId: id,
          fromStatus: process.status,
          toStatus: 'DRAFT',
          notes:
            data.changeSummary ||
            'Nueva versión creada; el procedimiento vuelve a borrador y requiere reaprobación.',
          actorId: session.user.id,
        },
      })
    }
    return record
  })

  if (mustReturnToDraft) {
    await AuditServiceComplete.log({
      action: AuditActionsComplete.PROCESS_STATUS_CHANGED,
      entityType: 'process',
      entityId: id,
      userId: session.user.id,
      oldValues: { status: process.status },
      newValues: { status: 'DRAFT' },
      details: {
        source: 'processes_module',
        reason: 'version_requires_reapproval',
        changeSummary: data.changeSummary || null,
      },
      request,
    })
  }

  await AuditServiceComplete.log({
    action: hasVersionPayload
      ? AuditActionsComplete.PROCESS_VERSION_CREATED
      : AuditActionsComplete.PROCESS_UPDATED,
    entityType: 'process',
    entityId: id,
    userId: session.user.id,
    oldValues: {
      title: process.title,
      ownerId: process.ownerId,
      criticality: process.criticality,
    },
    newValues: {
      title: updated.title,
      ownerId: updated.ownerId,
      criticality: updated.criticality,
    },
    details: { source: 'processes_module', createdVersion: hasVersionPayload },
    request,
  })
  return NextResponse.json({ process: updated })
}
