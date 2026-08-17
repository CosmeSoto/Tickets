import { unlink } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import { getUploadDir } from '@/lib/upload-path'

export type DeletedAccessPassSummary = {
  id: string
  credentialCode: string
  familyId: string
  status: string
  subjectId: string
}

async function removeStoredPhoto(photoPath: string | null | undefined) {
  if (!photoPath) return
  const resolved = path.resolve(photoPath)
  const root = path.resolve(getUploadDir())
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  if (resolved !== root && !resolved.startsWith(prefix)) return
  try {
    await unlink(resolved)
  } catch {
    // El archivo puede no existir; el registro ya se elimina.
  }
}

/** Borra pases de forma permanente. Si la persona no queda con más pases, también se elimina. */
export async function hardDeleteAccessPasses(ids: string[]): Promise<{
  deleted: DeletedAccessPassSummary[]
  subjectsRemoved: number
}> {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return { deleted: [], subjectsRemoved: 0 }

  const db = prisma as any
  const passes = await db.access_passes.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true,
      credentialCode: true,
      familyId: true,
      status: true,
      subjectId: true,
      subject: { select: { id: true, photoPath: true } },
    },
  })
  if (passes.length === 0) return { deleted: [], subjectsRemoved: 0 }

  const passIds = passes.map((pass: { id: string }) => pass.id)
  const subjectIds = [...new Set(passes.map((pass: { subjectId: string }) => pass.subjectId))]
  const photosBySubject = new Map(
    passes.map(
      (pass: { subject: { id: string; photoPath: string | null } }) =>
        [pass.subject.id, pass.subject.photoPath] as const
    )
  )

  const orphanIds: string[] = await db.$transaction(async (tx: any) => {
    await tx.access_passes.deleteMany({ where: { id: { in: passIds } } })
    const remaining = await tx.access_passes.findMany({
      where: { subjectId: { in: subjectIds } },
      select: { subjectId: true },
    })
    const stillUsed = new Set(remaining.map((row: { subjectId: string }) => row.subjectId))
    const orphans = subjectIds.filter((id: string) => !stillUsed.has(id))
    if (orphans.length > 0) {
      await tx.access_subjects.deleteMany({ where: { id: { in: orphans } } })
    }
    return orphans
  })

  await Promise.all(orphanIds.map(id => removeStoredPhoto(photosBySubject.get(id))))

  return {
    deleted: passes.map((pass: DeletedAccessPassSummary) => ({
      id: pass.id,
      credentialCode: pass.credentialCode,
      familyId: pass.familyId,
      status: pass.status,
      subjectId: pass.subjectId,
    })),
    subjectsRemoved: orphanIds.length,
  }
}
