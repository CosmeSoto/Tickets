import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { FileService } from '@/lib/services/file-service'
import {
  assertCanManageProcesses,
  getProcessAccess,
  isFamilyWithinProcessScope,
  sanitizeProcessAttachment,
} from '@/lib/processes/access'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

type Params = { params: Promise<{ id: string }> }

const reviewJsonSchema = z.object({
  provider: z.string().trim().min(2).max(150).default('Privacy Driver'),
  externalReference: z.string().trim().max(150).optional().nullable(),
  status: z.enum(['PENDING', 'SENT', 'REVIEWED', 'OBSERVED']),
  notes: z.string().trim().max(5000).optional().nullable(),
  sentAt: z.string().datetime().optional().nullable(),
  reviewedAt: z.string().datetime().optional().nullable(),
  versionId: z.string().uuid().optional(),
  /** Referencia textual/URL cuando no se adjunta archivo. */
  evidenceReference: z.string().trim().min(3).max(500).optional().nullable(),
  /** Adjunto existente del proceso usado como evidencia. */
  evidenceAttachmentId: z.string().uuid().optional().nullable(),
})

function sanitizeReview(review: any) {
  return {
    id: review.id,
    versionId: review.versionId,
    provider: review.provider,
    externalReference: review.externalReference,
    status: review.status,
    notes: review.notes,
    sentAt: review.sentAt,
    reviewedAt: review.reviewedAt,
    recordedById: review.recordedById,
    recordedBy: review.recordedBy,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    hasEvidence: Boolean(review.evidencePath),
  }
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id } = await params
  const access = await getProcessAccess(session.user.id, session.user.role)
  const process = await (prisma as any).processes.findUnique({
    where: { id },
    select: {
      id: true,
      familyId: true,
      versions: {
        orderBy: { versionNumber: 'desc' },
        select: {
          id: true,
          versionNumber: true,
          externalReviews: {
            include: { recordedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })
  if (!process || !isFamilyWithinProcessScope(access, process.familyId)) {
    return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })
  }

  return NextResponse.json({
    reviews: process.versions.flatMap((version: any) =>
      version.externalReviews.map((review: any) => ({
        ...sanitizeReview(review),
        versionNumber: version.versionNumber,
      }))
    ),
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const denied = await assertCanManageProcesses(session.user.id, session.user.role)
  if (denied) return denied

  const { id } = await params
  const access = await getProcessAccess(session.user.id, session.user.role)
  const process = await (prisma as any).processes.findUnique({
    where: { id },
    select: {
      id: true,
      familyId: true,
      versions: { orderBy: { versionNumber: 'desc' }, select: { id: true, versionNumber: true } },
    },
  })
  if (!process || !isFamilyWithinProcessScope(access, process.familyId)) {
    return NextResponse.json({ error: 'Proceso no encontrado.' }, { status: 404 })
  }
  if (!process.versions.length) {
    return NextResponse.json({ error: 'El proceso no tiene versiones.' }, { status: 422 })
  }

  const contentType = request.headers.get('content-type') || ''
  let payload: z.infer<typeof reviewJsonSchema>
  let uploadedEvidence: { path: string; attachment?: any } | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const file = form.get('file')
    payload = reviewJsonSchema.parse({
      provider: form.get('provider') || 'Privacy Driver',
      externalReference: form.get('externalReference') || null,
      status: form.get('status') || 'PENDING',
      notes: form.get('notes') || null,
      sentAt: form.get('sentAt') || null,
      reviewedAt: form.get('reviewedAt') || null,
      versionId: form.get('versionId') || undefined,
      evidenceReference: form.get('evidenceReference') || null,
      evidenceAttachmentId: form.get('evidenceAttachmentId') || null,
    })
    if (file instanceof File && file.size > 0) {
      const attachment = await FileService.uploadProcessFile({
        file,
        processId: id,
        uploadedById: session.user.id,
      })
      uploadedEvidence = { path: attachment.path, attachment }
    }
  } else {
    const parsed = reviewJsonSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de revisión externa inválidos.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    payload = parsed.data
  }

  const versionId = payload.versionId || process.versions[0].id
  if (!process.versions.some((version: { id: string }) => version.id === versionId)) {
    return NextResponse.json({ error: 'La versión no pertenece a este proceso.' }, { status: 400 })
  }

  let evidencePath: string | null = uploadedEvidence?.path || null
  if (!evidencePath && payload.evidenceAttachmentId) {
    const attachment = await (prisma as any).process_attachments.findFirst({
      where: { id: payload.evidenceAttachmentId, processId: id },
      select: { path: true },
    })
    if (!attachment) {
      return NextResponse.json({ error: 'El adjunto de evidencia no existe.' }, { status: 400 })
    }
    evidencePath = attachment.path
  }
  if (!evidencePath && payload.evidenceReference) {
    evidencePath = payload.evidenceReference
  }

  if ((payload.status === 'REVIEWED' || payload.status === 'OBSERVED') && !evidencePath) {
    return NextResponse.json(
      {
        error:
          'Debe adjuntar evidencia (archivo), seleccionar un adjunto del proceso o indicar una referencia externa.',
      },
      { status: 422 }
    )
  }

  const review = await (prisma as any).process_external_reviews.create({
    data: {
      versionId,
      provider: payload.provider,
      externalReference: payload.externalReference || null,
      status: payload.status,
      notes: payload.notes || null,
      evidencePath,
      sentAt: payload.sentAt ? new Date(payload.sentAt) : null,
      reviewedAt: payload.reviewedAt
        ? new Date(payload.reviewedAt)
        : payload.status === 'REVIEWED' || payload.status === 'OBSERVED'
          ? new Date()
          : null,
      recordedById: session.user.id,
    },
    include: { recordedBy: { select: { id: true, name: true } } },
  })

  await AuditServiceComplete.log({
    action: AuditActionsComplete.PROCESS_EXTERNAL_REVIEW_RECORDED,
    entityType: 'process',
    entityId: id,
    userId: session.user.id,
    details: {
      source: 'processes_module',
      reviewId: review.id,
      versionId,
      status: review.status,
      provider: review.provider,
      hasEvidence: Boolean(evidencePath),
      uploadedAttachmentId: uploadedEvidence?.attachment?.id || null,
    },
    request,
  })

  return NextResponse.json(
    {
      review: sanitizeReview(review),
      attachment: uploadedEvidence?.attachment
        ? sanitizeProcessAttachment(uploadedEvidence.attachment)
        : undefined,
    },
    { status: 201 }
  )
}
