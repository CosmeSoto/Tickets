/**
 * Pub/Sub de notificaciones en tiempo real.
 *
 * Usa Redis Pub/Sub (getRedisPub / getRedisSub de @/lib/server) para
 * cruzar entre procesos/workers en producción.
 * Fallback a globalThis (in-memory) si Redis no está disponible.
 *
 * Canal Redis: "notifications:{userId}"
 */

import { getRedisPub, getRedisSub } from '@/lib/server'

type Subscriber = (data: string) => void

// ── In-memory subscribers (por proceso) ──────────────────────────────────────
const GLOBAL_KEY = '__notificationEventSubscribers__'

function getLocalSubscribers(): Map<string, Set<Subscriber>> {
  if (!(globalThis as any)[GLOBAL_KEY]) {
    ;(globalThis as any)[GLOBAL_KEY] = new Map<string, Set<Subscriber>>()
  }
  return (globalThis as any)[GLOBAL_KEY]
}

// ── Suscripción Redis por userId ──────────────────────────────────────────────
async function ensureRedisSubscription(userId: string) {
  const sub = getRedisSub()
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
  } catch { /* Redis no disponible — fallback in-memory */ }
}

// ── API pública ───────────────────────────────────────────────────────────────
export const NotificationEvents = {
  subscribe(userId: string, fn: Subscriber): () => void {
    const subscribers = getLocalSubscribers()
    if (!subscribers.has(userId)) {
      subscribers.set(userId, new Set())
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
    const pub = getRedisPub()
    if (pub) {
      pub.publish(`notifications:${userId}`, payload).catch(() => { /* Redis no disponible */ })
    }
  },

  emitToMany(userIds: string[], event: { type: string; [key: string]: unknown }) {
    userIds.forEach(id => this.emit(id, event))
  },
}
