/**
 * Pub/Sub de notificaciones en tiempo real.
 *
 * Usa Redis Pub/Sub para cruzar entre procesos/workers en producción.
 * Fallback a globalThis (in-memory) si Redis no está disponible.
 *
 * Canal Redis: "notifications:{userId}"
 */

import Redis from 'ioredis'

type Subscriber = (data: string) => void

// ── In-memory subscribers (por proceso) ──────────────────────────────────────
const GLOBAL_KEY = '__notificationEventSubscribers__'

function getLocalSubscribers(): Map<string, Set<Subscriber>> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    ;(globalThis as any)[GLOBAL_KEY] = new Map<string, Set<Subscriber>>()
  }
  return (globalThis as any)[GLOBAL_KEY]
}

// ── Redis subscriber singleton ────────────────────────────────────────────────
const REDIS_SUB_KEY = '__notificationRedisSubscriber__'

function getRedisSubscriber(): Redis | null {
  if (!(globalThis as any)[REDIS_SUB_KEY]) {
    if (!process.env.REDIS_URL) return null
    try {
      const sub = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        family: 4,
      })
      sub.on('error', () => { /* silencioso — fallback a in-memory */ })
      ;(globalThis as any)[REDIS_SUB_KEY] = sub
    } catch {
      return null
    }
  }
  return (globalThis as any)[REDIS_SUB_KEY] as Redis
}

// Suscribir el proceso actual a los mensajes Redis de un userId
async function ensureRedisSubscription(userId: string) {
  const sub = getRedisSubscriber()
  if (!sub) return

  const channel = `notifications:${userId}`
  try {
    await sub.subscribe(channel)
    sub.on('message', (ch: string, payload: string) => {
      if (ch !== channel) return
      const localSubs = getLocalSubscribers().get(userId)
      if (localSubs) {
        localSubs.forEach(fn => {
          try { fn(payload) } catch { /* cliente desconectado */ }
        })
      }
    })
  } catch { /* Redis no disponible */ }
}

// ── Publisher singleton (distinto del subscriber) ────────────────────────────
const REDIS_PUB_KEY = '__notificationRedisPublisher__'

function getRedisPublisher(): Redis | null {
  if (!(globalThis as any)[REDIS_PUB_KEY]) {
    if (!process.env.REDIS_URL) return null
    try {
      const pub = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        family: 4,
      })
      pub.on('error', () => { /* silencioso */ })
      ;(globalThis as any)[REDIS_PUB_KEY] = pub
    } catch {
      return null
    }
  }
  return (globalThis as any)[REDIS_PUB_KEY] as Redis
}

// ── API pública ───────────────────────────────────────────────────────────────
export const NotificationEvents = {
  subscribe(userId: string, fn: Subscriber): () => void {
    const subscribers = getLocalSubscribers()
    if (!subscribers.has(userId)) {
      subscribers.set(userId, new Set())
      // Suscribir al canal Redis de este usuario (async, no bloquea)
      ensureRedisSubscription(userId).catch(() => { /* fallback in-memory */ })
    }
    subscribers.get(userId)!.add(fn)

    return () => {
      const subs = subscribers.get(userId)
      if (subs) {
        subs.delete(fn)
        if (subs.size === 0) subscribers.delete(userId)
      }
    }
  },

  emit(userId: string, event: { type: string; [key: string]: unknown }) {
    const payload = `data: ${JSON.stringify(event)}\n\n`

    // 1. Entregar localmente (mismo proceso)
    const localSubs = getLocalSubscribers().get(userId)
    if (localSubs) {
      localSubs.forEach(fn => {
        try { fn(payload) } catch { /* cliente desconectado */ }
      })
    }

    // 2. Publicar en Redis para otros procesos/workers
    const pub = getRedisPublisher()
    if (pub) {
      pub.publish(`notifications:${userId}`, payload).catch(() => { /* Redis no disponible */ })
    }
  },

  emitToMany(userIds: string[], event: { type: string; [key: string]: unknown }) {
    userIds.forEach(id => this.emit(id, event))
  },
}
