#!/usr/bin/env node
/**
 * Backup Worker — ejecuta pgBackRest fuera del contenedor de la app.
 * Solo accesible en la red interna de Docker.
 */
import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(execFile)

const PORT = Number(process.env.PORT || 8080)
const SECRET = process.env.BACKUP_WORKER_SECRET || ''
const STANZA = process.env.PGBACKREST_STANZA || 'main'
const ALLOW_RESTORE = process.env.BACKUP_ALLOW_RESTORE === 'true'

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function unauthorized(res) {
  json(res, 401, { error: 'No autorizado' })
}

function checkAuth(req) {
  if (!SECRET) return false
  const header = req.headers.authorization || ''
  return header === `Bearer ${SECRET}`
}

async function runPgBackRest(args, timeoutMs = 3_600_000) {
  const { stdout, stderr } = await exec('pgbackrest', args, {
    timeout: timeoutMs,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, PGBACKREST_CONFIG: '/etc/pgbackrest/pgbackrest.conf' },
  })
  return { stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' }
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

    if (url.pathname === '/health' && req.method === 'GET') {
      let pgbackrestOk = false
      let stanzaOk = false
      try {
        await runPgBackRest(['version'], 10_000)
        pgbackrestOk = true
        await runPgBackRest(['check', `--stanza=${STANZA}`], 120_000)
        stanzaOk = true
      } catch {
        /* health parcial */
      }
      return json(res, 200, {
        status: pgbackrestOk && stanzaOk ? 'healthy' : 'degraded',
        pgbackrestOk,
        stanzaOk,
        stanza: STANZA,
        allowRestore: ALLOW_RESTORE,
        timestamp: new Date().toISOString(),
      })
    }

    if (!checkAuth(req)) return unauthorized(res)

    if (url.pathname === '/info' && req.method === 'GET') {
      const { stdout } = await runPgBackRest(['info', `--stanza=${STANZA}`, '--output=json'])
      const parsed = JSON.parse(stdout || '[]')
      return json(res, 200, { stanza: STANZA, info: parsed })
    }

    if (url.pathname === '/backup' && req.method === 'POST') {
      const body = await readBody(req)
      const type = ['full', 'diff', 'incr'].includes(body.type) ? body.type : 'diff'
      const start = Date.now()
      await runPgBackRest(['backup', `--stanza=${STANZA}`, `--type=${type}`])
      const { stdout } = await runPgBackRest(['info', `--stanza=${STANZA}`, '--output=json'])
      const info = JSON.parse(stdout || '[]')
      const stanzaInfo = info[0] || {}
      const lastBackup = stanzaInfo['backup']?.slice(-1)[0] || null
      return json(res, 200, {
        success: true,
        type,
        durationMs: Date.now() - start,
        backup: lastBackup,
      })
    }

    if (url.pathname === '/verify' && req.method === 'POST') {
      await runPgBackRest(['verify', `--stanza=${STANZA}`])
      return json(res, 200, { success: true })
    }

    if (url.pathname === '/restore' && req.method === 'POST') {
      if (!ALLOW_RESTORE) {
        return json(res, 403, {
          error: 'Restauración pgBackRest deshabilitada. Establece BACKUP_ALLOW_RESTORE=true',
        })
      }
      const body = await readBody(req)
      const args = ['restore', `--stanza=${STANZA}`, '--type=default', '--delta']
      if (body.set) args.push(`--set=${body.set}`)
      if (body.target) {
        args.push(`--type=time`, `--target="${body.target}"`, '--target-action=promote')
      }
      await runPgBackRest(args, 3_600_000)
      return json(res, 200, { success: true, message: 'Restauración pgBackRest completada' })
    }

    json(res, 404, { error: 'Ruta no encontrada' })
  } catch (error) {
    console.error('[backup-worker]', error)
    json(res, 500, {
      error: error instanceof Error ? error.message : 'Error interno',
      stderr: error?.stderr?.toString?.() || undefined,
    })
  }
})

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`[backup-worker] Escuchando en :${PORT} stanza=${STANZA}`)
  try {
    await runPgBackRest(['stanza-create', `--stanza=${STANZA}`], 60_000)
    console.log('[backup-worker] Stanza lista')
  } catch (e) {
    console.warn('[backup-worker] stanza-create:', e instanceof Error ? e.message : e)
  }
})
