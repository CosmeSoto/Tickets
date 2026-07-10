#!/usr/bin/env node
/**
 * Backup Worker — ejecuta pgBackRest fuera del contenedor de la app.
 * Solo accesible en la red interna de Docker.
 */
import http from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, writeFile } from 'fs/promises'

const exec = promisify(execFile)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const PORT = Number(process.env.PORT || 8080)
const SECRET = process.env.BACKUP_WORKER_SECRET || ''
const STANZA = process.env.PGBACKREST_STANZA || 'main'
const ALLOW_RESTORE = process.env.BACKUP_ALLOW_RESTORE === 'true'
const PGBR_CONFIG = '/etc/pgbackrest/pgbackrest-local.conf'
const BOOTSTRAP_MARKER = '/var/lib/pgbackrest/.bootstrap_done'

let stanzaReady = false
let initPromise = null

function startInit() {
  if (!initPromise) {
    initPromise = ensureStanzaReady().then(result => {
      stanzaReady = result.ok && !result.needsPostgresRestart
      return result
    })
  }
  return initPromise
}

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

async function isBootstrapComplete() {
  try {
    await access(BOOTSTRAP_MARKER)
    return true
  } catch {
    return false
  }
}

async function markBootstrapComplete() {
  await writeFile(BOOTSTRAP_MARKER, `completed ${new Date().toISOString()}\n`, { mode: 0o640 })
}

async function waitForArchiveModeOn(maxAttempts = 90) {
  const pgpass = process.env.PGPASSWORD || ''
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const { stdout } = await exec(
        'psql',
        ['-h', 'postgres', '-U', 'tickets_user', '-d', 'tickets_db', '-tAc', 'SHOW archive_mode'],
        { timeout: 5000, env: { ...process.env, PGPASSWORD: pgpass } }
      )
      if (stdout?.toString().trim() === 'on') return true
    } catch {
      // postgres puede estar reiniciando
    }
    if (i === 1 || i % 6 === 0) {
      console.log(`[backup-worker] Esperando archive_mode=on (${i}/${maxAttempts})...`)
    }
    await sleep(5000)
  }
  return false
}

async function finalizeBootstrap() {
  await markBootstrapComplete()
  console.log('[backup-worker] Marcador creado — postgres se reiniciará solo para activar archive_mode')
  const enabled = await waitForArchiveModeOn(90)
  if (!enabled) {
    console.warn('[backup-worker] archive_mode sigue off — pulsa Inicializar de nuevo en unos segundos')
    return { ok: true, needsPostgresRestart: true }
  }
  await waitPostgresReady(30)
  await runPgBackRest(['check', `--stanza=${STANZA}`], 120_000)
  stanzaReady = true
  console.log('[backup-worker] Bootstrap completado — stanza operativa')
  return { ok: true, needsPostgresRestart: false }
}

async function runPgBackRest(args, timeoutMs = 3_600_000) {
  const { stdout, stderr } = await exec('pgbackrest', args, {
    timeout: timeoutMs,
    maxBuffer: 50 * 1024 * 1024,
    env: { ...process.env, PGBACKREST_CONFIG: PGBR_CONFIG },
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

async function waitPostgresReady(maxAttempts = 60) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await exec('pg_isready', ['-h', 'postgres', '-U', 'tickets_user', '-d', 'tickets_db'], {
        timeout: 5000,
      })
      return
    } catch {
      console.log(`[backup-worker] Esperando PostgreSQL (${i}/${maxAttempts})...`)
      await sleep(3000)
    }
  }
  throw new Error('PostgreSQL no disponible tras esperar 3 minutos')
}

function normalizeBackupEntry(entry) {
  if (!entry) return null
  let ts = entry.timestamp
  if (ts && typeof ts === 'object') {
    ts = ts.stop ?? ts.start ?? null
  }
  const info = entry.info || {}
  return {
    label: entry.label,
    type: entry.type,
    timestamp: typeof ts === 'number' ? ts : undefined,
    size: info.size ?? info['repository-size'] ?? entry.size ?? 0,
  }
}

async function hasExistingBackups() {
  try {
    const { stdout } = await runPgBackRest(['info', `--stanza=${STANZA}`, '--output=json'], 30_000)
    const info = JSON.parse(stdout || '[]')
    const backups = info[0]?.backup
    return Array.isArray(backups) && backups.length > 0
  } catch {
    return false
  }
}

async function ensureStanzaReady() {
  await waitPostgresReady()

  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const bootstrapped = await isBootstrapComplete()
      console.log(`[backup-worker] Sync stanza (intento ${attempt}/12, bootstrap=${bootstrapped})...`)

      if (!bootstrapped) {
        console.log('[backup-worker] Bootstrap — stanza-create + backup FULL...')
        await runPgBackRest(['stanza-create', `--stanza=${STANZA}`], 120_000)
        await runPgBackRest(
          ['backup', `--stanza=${STANZA}`, '--type=full', '--no-archive-check'],
          3_600_000
        )
        return finalizeBootstrap()
      }

      await runPgBackRest(['stanza-create', `--stanza=${STANZA}`], 120_000)

      try {
        await runPgBackRest(['check', `--stanza=${STANZA}`], 120_000)
      } catch (checkErr) {
        if (!(await hasExistingBackups())) {
          console.log('[backup-worker] Sin backups — ejecutando FULL...')
          await runPgBackRest(
            ['backup', `--stanza=${STANZA}`, '--type=full', '--no-archive-check'],
            3_600_000
          )
          await runPgBackRest(['check', `--stanza=${STANZA}`], 120_000)
        } else {
          throw checkErr
        }
      }

      stanzaReady = true
      console.log('[backup-worker] Stanza lista')
      return { ok: true, needsPostgresRestart: false }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const stderr = error?.stderr?.toString?.() || ''
      console.warn(`[backup-worker] init falló: ${msg}`)
      if (stderr) console.warn(stderr.slice(0, 800))
      await sleep(5000)
    }
  }

  stanzaReady = false
  console.error('[backup-worker] Stanza NO inicializada — servicio en modo degradado')
  return { ok: false, needsPostgresRestart: false }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`)

    if (url.pathname === '/health' && req.method === 'GET') {
      let pgbackrestOk = false
      let stanzaOk = stanzaReady
      try {
        await runPgBackRest(['version'], 10_000)
        pgbackrestOk = true
        if (!stanzaOk) {
          await runPgBackRest(['check', `--stanza=${STANZA}`], 120_000)
          stanzaOk = true
          stanzaReady = true
        }
      } catch {
        stanzaOk = false
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

    if (url.pathname === '/init' && req.method === 'POST') {
      stanzaReady = false
      initPromise = null
      const result = await startInit()
      const status = result.ok ? 200 : 503
      return json(res, status, {
        success: result.ok,
        stanzaOk: stanzaReady,
        needsPostgresRestart: result.needsPostgresRestart,
      })
    }

    if (url.pathname === '/info' && req.method === 'GET') {
      const { stdout } = await runPgBackRest(['info', `--stanza=${STANZA}`, '--output=json'])
      const parsed = JSON.parse(stdout || '[]')
      return json(res, 200, { stanza: STANZA, info: parsed })
    }

    if (url.pathname === '/backup' && req.method === 'POST') {
      if (!stanzaReady) {
        const result = await startInit()
        if (!result.ok) {
          return json(res, 503, {
            error:
              'pgBackRest no inicializado. Ejecuta ./docker/scripts/init-pgbackrest.sh en el servidor.',
          })
        }
        if (result.needsPostgresRestart) {
          return json(res, 503, {
            error:
              'Bootstrap completado — pulsa Inicializar de nuevo o reinicia postgres desde el servidor',
          })
        }
      }
      const body = await readBody(req)
      const type = ['full', 'diff', 'incr'].includes(body.type) ? body.type : 'diff'
      const start = Date.now()
      await runPgBackRest(['backup', `--stanza=${STANZA}`, `--type=${type}`])
      const { stdout } = await runPgBackRest(['info', `--stanza=${STANZA}`, '--output=json'])
      const info = JSON.parse(stdout || '[]')
      const stanzaInfo = info[0] || {}
      const lastBackup = normalizeBackupEntry(stanzaInfo['backup']?.slice(-1)[0] || null)
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
      const body = await readBody(req)

      if (!body.uiAuthorized) {
        return json(res, 403, {
          error:
            'Restauración no autorizada. Actívala en Admin → Backups → Config y vuelve a intentar.',
        })
      }

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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[backup-worker] Escuchando en :${PORT} stanza=${STANZA} config=${PGBR_CONFIG}`)
  startInit().then(result => {
    if (result.needsPostgresRestart) {
      console.log('[backup-worker] Bootstrap OK — pendiente: docker compose restart postgres')
    } else {
      console.log(`[backup-worker] Inicialización ${result.ok ? 'completada' : 'fallida'}`)
    }
  })
})

process.on('SIGTERM', () => {
  console.log('[backup-worker] SIGTERM — cerrando')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
})
