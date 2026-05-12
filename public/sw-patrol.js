// Service Worker para el módulo de patrullas.
// Intercepta POST /api/patrols/:id/check-in cuando no hay red.
// Retorna { queued: true } con status 202 y X-Patrol-Queued: 1.
// Registra 'patrol-sync' Background Sync al recuperar conectividad.

const PATROL_CHECKIN_PATTERN = /^\/api\/patrols\/[^/]+\/check-in$/

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Solo interceptar POST a /api/patrols/*/check-in (no /sync)
  if (event.request.method !== 'POST') return
  if (!PATROL_CHECKIN_PATTERN.test(url.pathname)) return

  event.respondWith(
    fetch(event.request.clone()).catch(async () => {
      // Sin red — registrar Background Sync si está disponible
      if ('sync' in self.registration) {
        try {
          await self.registration.sync.register('patrol-sync')
        } catch {
          // Background Sync no disponible en este navegador
        }
      }

      // Responder con 202 Queued
      return new Response(JSON.stringify({ queued: true, message: 'Check-in guardado offline' }), {
        status: 202,
        headers: {
          'Content-Type': 'application/json',
          'X-Patrol-Queued': '1',
        },
      })
    })
  )
})

// Background Sync — cuando se recupera la conexión
self.addEventListener('sync', event => {
  if (event.tag === 'patrol-sync') {
    // El cliente maneja la sincronización real vía usePatrolOfflineQueue.syncNow()
    // El SW solo notifica al cliente que hay conectividad
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'PATROL_SYNC_READY' })
        })
      })
    )
  }
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})
