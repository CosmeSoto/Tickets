import prisma from '@/lib/prisma'
import { removeStoredAccessPhoto } from '@/lib/access/access-photo-storage'

export type DeletedAccessPassSummary = {
  id: string
  credentialCode: string
  familyId: string
  status: string
  subjectId: string
}

/**
 * Borra pases de forma permanente. Si la persona no queda con más pases,
 * también se elimina.
 *
 * `allowedFamilyIds` (`undefined` = scope global, Super Admin) filtra qué
 * pases de los solicitados se llegan a borrar — hoy `canDelete` es exclusivo
 * de Super Admin así que este filtro es defensa en profundidad, pero evita
 * que un borrado masivo alcance pases fuera de área el día que se delegue
 * el permiso. Los ids fuera de scope se devuelven en `skippedIds` en vez de
 * fallar silenciosamente.
 */
export async function hardDeleteAccessPasses(
  ids: string[],
  allowedFamilyIds?: string[]
): Promise<{
  deleted: DeletedAccessPassSummary[]
  subjectsRemoved: number
  skippedIds: string[]
}> {
  const uniqueIds = [...new Set(ids.filter(Boolean))]
  if (uniqueIds.length === 0) return { deleted: [], subjectsRemoved: 0, skippedIds: [] }

  const db = prisma
  const passes = await db.access_passes.findMany({
    where: {
      id: { in: uniqueIds },
      ...(allowedFamilyIds ? { familyId: { in: allowedFamilyIds } } : {}),
    },
    select: {
      id: true,
      credentialCode: true,
      familyId: true,
      status: true,
      subjectId: true,
      subject: { select: { id: true, photoPath: true } },
    },
  })
  const skippedIds = uniqueIds.filter(id => !passes.some((p: { id: string }) => p.id === id))
  if (passes.length === 0) return { deleted: [], subjectsRemoved: 0, skippedIds }

  const passIds = (passes as Array<{ id: string }>).map(p => p.id)
  const subjectIds: string[] = [
    ...new Set((passes as Array<{ subjectId: string }>).map(p => p.subjectId)),
  ]
  const photosBySubject = new Map<string, string | null>(
    (passes as Array<{ subject: { id: string; photoPath: string | null } }>).map(
      pass => [pass.subject.id, pass.subject.photoPath] as [string, string | null]
    )
  )

  const orphanIds = (await db.$transaction(async (tx: any) => {
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
  })) as string[]

  await Promise.all(orphanIds.map(id => removeStoredAccessPhoto(photosBySubject.get(id) ?? null)))

  return {
    deleted: passes.map((pass: DeletedAccessPassSummary) => ({
      id: pass.id,
      credentialCode: pass.credentialCode,
      familyId: pass.familyId,
      status: pass.status,
      subjectId: pass.subjectId,
    })),
    subjectsRemoved: orphanIds.length,
    skippedIds,
  }
}
