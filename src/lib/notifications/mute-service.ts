import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { buildEntityKey } from '@/lib/notifications/entity-key'

export type MuteDuration = '1h' | '8h' | '24h' | 'forever'

export function resolveMutedUntil(duration: MuteDuration): Date | null {
  const now = Date.now()
  switch (duration) {
    case '1h':
      return new Date(now + 60 * 60 * 1000)
    case '8h':
      return new Date(now + 8 * 60 * 60 * 1000)
    case '24h':
      return new Date(now + 24 * 60 * 60 * 1000)
    case 'forever':
      return null
  }
}

/** true si el usuario tiene un mute activo para esa entidad. */
export async function isEntityMuted(userId: string, entityKey: string): Promise<boolean> {
  const mute = await prisma.notification_mutes.findUnique({
    where: { userId_entityKey: { userId, entityKey } },
    select: { mutedUntil: true },
  })
  if (!mute) return false
  if (mute.mutedUntil === null) return true
  return mute.mutedUntil.getTime() > Date.now()
}

export async function isNotificationMuted(
  userId: string,
  data: { ticketId?: string | null; metadata?: Record<string, any> | null }
): Promise<boolean> {
  const key = buildEntityKey(data)
  if (!key) return false
  return isEntityMuted(userId, key)
}

export async function upsertMute(userId: string, entityKey: string, mutedUntil: Date | null) {
  return prisma.notification_mutes.upsert({
    where: { userId_entityKey: { userId, entityKey } },
    create: {
      id: randomUUID(),
      userId,
      entityKey,
      mutedUntil,
      updatedAt: new Date(),
    },
    update: {
      mutedUntil,
      updatedAt: new Date(),
    },
  })
}

export async function removeMute(userId: string, entityKey: string) {
  return prisma.notification_mutes.deleteMany({
    where: { userId, entityKey },
  })
}

export async function listActiveMutes(userId: string) {
  const now = new Date()
  return prisma.notification_mutes.findMany({
    where: {
      userId,
      OR: [{ mutedUntil: null }, { mutedUntil: { gt: now } }],
    },
    orderBy: { updatedAt: 'desc' },
  })
}

/** Limpia mutes temporales ya vencidos (best-effort). */
export async function cleanupExpiredMutes(userId?: string) {
  return prisma.notification_mutes.deleteMany({
    where: {
      ...(userId ? { userId } : {}),
      mutedUntil: { lt: new Date() },
    },
  })
}
