/**
 * Rate limit para intentos de /vincular (anti fuerza bruta de códigos).
 * Redis si está disponible; fallback en memoria para dev/single-instance.
 */

import { getRedis } from '@/lib/server'

const MAX_ATTEMPTS = 8
const WINDOW_MS = 15 * 60 * 1000

type MemoryEntry = { count: number; resetAt: number }
const memoryStore = new Map<string, MemoryEntry>()

function memoryCheck(key: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)
  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0 }
  }
  entry.count++
  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count }
}

export async function checkTelegramVincularRateLimit(
  chatId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `telegram:vincular:${chatId}`
  const redis = getRedis()

  if (!redis) {
    return memoryCheck(key)
  }

  try {
    const multi = redis.multi()
    multi.incr(key)
    multi.pttl(key)
    const results = await multi.exec()
    const count = Number(results?.[0]?.[1] ?? 1)
    let ttl = Number(results?.[1]?.[1] ?? -1)

    if (ttl === -1) {
      await redis.pexpire(key, WINDOW_MS)
      ttl = WINDOW_MS
    }

    if (count > MAX_ATTEMPTS) {
      return { allowed: false, remaining: 0 }
    }

    return { allowed: true, remaining: MAX_ATTEMPTS - count }
  } catch (error) {
    console.error('[TELEGRAM] Rate limit Redis error, fail-open:', error)
    return { allowed: true, remaining: MAX_ATTEMPTS }
  }
}

export async function resetTelegramVincularRateLimit(chatId: string): Promise<void> {
  const key = `telegram:vincular:${chatId}`
  memoryStore.delete(key)
  const redis = getRedis()
  if (redis) {
    await redis.del(key).catch(() => {})
  }
}
