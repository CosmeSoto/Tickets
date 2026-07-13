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
const PG_DATA_DIR = '/var/lib/postgresql/data'
const DOCKER_SOCKET = process.env.DOCKER_HOST || '/var/run/docker.sock'
const CONTAINER_POSTGRES = process.env.CONTAINER_POSTGRES || 'tickets-postgres'
const CONTAINER_APP = process.env.CONTAINER_APP || 'tickets-app'
const CONTAINER_NGINX = process.env.CONTAINER_NGINX || 'tickets-nginx'

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
  try {
    const { stdout, stderr } = await exec('pgbackrest', args, {
      timeout: timeoutMs,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, PGBACKREST_CONFIG: PGBR_CONFIG },
    })
    return { stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' }
  } catch (error) {
    const stdout = error?.stdout?.toString?.() || ''
    const stderr = error?.stderr?.toString?.() || ''
    const combined = `${stdout}\n${stderr}`
    if (combined.includes('unable to restore while PostgreSQL is running')) {
      throw new Error(
        'PostgreSQL debe estar detenido para restaurar pgBackRest. El worker reintentará detener los contenedores automáticamente.'
      )
    }
    const match = combined.match(/ERROR:\s*\[[^\]]+\]:\s*(.+)/)
    throw new Error(match?.[1]?.trim() || error.message || 'Error pgBackRest')
  }
}

async function dockerAvailable() {
  try {
    await access(DOCKER_SOCKET)
    await exec('docker', ['info'], { timeout: 15_000, env: process.env })
    return true
  } catch {
    return false
  }
}

async function dockerStopContainers(names) {
  if (!(await dockerAvailable())) {
    throw new Error(
      'Docker socket no disponible en backup-worker. Monta /var/run/docker.sock, define DOCKER_GID (Mac: 1, Linux: getent group docker) y group_add en docker-compose.'
    )
  }
  console.log(`[backup-worker] Deteniendo contenedores: ${names.join(', ')}`)
  await exec('docker', ['stop', '-t', '60', ...names], {
    timeout: 180_000,
    env: process.env,
  })
}

async function dockerStartContainers(names) {
  console.log(`[backup-worker] Iniciando contenedores: ${names.join(', ')}`)
  await exec('docker', ['start', ...names], {
    timeout: 120_000,
    env: process.env,
  })
}

async function waitForPostmasterGone(maxAttempts = 90) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await access(`${PG_DATA_DIR}/postmaster.pid`)
      await sleep(1000)
    } catch {
      return
    }
  }
  throw new Error('postmaster.pid sigue presente — PostgreSQL no se detuvo correctamente')
}

async function prepareStackForRestore() {
  console.log('[backup-worker] Modo mantenimiento — deteniendo app, nginx y postgres...')
  await dockerStopContainers([CONTAINER_APP, CONTAINER_NGINX, CONTAINER_POSTGRES])
  await waitForPostmasterGone()
}

async function finalizeStackAfterRestore() {
  console.log('[backup-worker] Reiniciando servicios tras restauración...')
  await dockerStartContainers([CONTAINER_POSTGRES])
  await waitPostgresReady(90)
  await dockerStartContainers([CONTAINER_APP, CONTAINER_NGINX])
}

/** Estado de la última restauración pgBackRest (consultable tras reinicio de servicios). */
let restoreJob = {
  status: 'idle',
  message: null,
  label: null,
  startedAt: null,
  finishedAt: null,
}

async function runRestoreJob(body) {
  const args = ['restore', `--stanza=${STANZA}`, '--type=default', '--delta']
  if (body.set) args.push(`--set=${body.set}`)
  if (body.target) {
    args.push(`--type=time`, `--target="${body.target}"`, '--target-action=promote')
  }

  restoreJob = {
    status: 'running',
    message: 'Deteniendo servicios y restaurando cluster…',
    label: body.set || null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  }

  let restoreOk = false

  try {
    await prepareStackForRestore()
    console.log(`[backup-worker] Ejecutando: pgbackrest ${args.join(' ')}`)
    restoreJob.message = 'Ejecutando pgbackrest restore (puede tardar varios minutos)…'
    await runPgBackRest(args, 3_600_000)
    console.log('[backup-worker] pgbackrest restore completado')
    restoreOk = true
    restoreJob.status = 'success'
    restoreJob.message = 'Restauración pgBackRest completada'
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[backup-worker] restore error:', error)
    restoreJob.status = 'failed'
    restoreJob.message = msg
  } finally {
    restoreJob.finishedAt = new Date().toISOString()
    try {
      await finalizeStackAfterRestore()
      console.log('[backup-worker] Servicios reiniciados tras restauración')
    } catch (restartErr) {
      console.error('[backup-worker] Error reiniciando stack:', restartErr)
      if (restoreOk) {
        restoreJob.message =
          'Restauración OK pero reinicio parcial — ejecuta: docker compose up -d'
      }
    }
  }
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
        asyncRestore: true,
        dockerOk: await dockerAvailable(),
        containers: {
          postgres: CONTAINER_POSTGRES,
          app: CONTAINER_APP,
          nginx: CONTAINER_NGINX,
        },
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
      try {
        await runPgBackRest(['expire', `--stanza=${STANZA}`])
        console.log('[backup-worker] expire completado tras backup')
      } catch (expireErr) {
        console.warn('[backup-worker] expire falló (backup OK):', expireErr)
      }
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

      if (restoreJob.status === 'running') {
        return json(res, 409, {
          error: 'Ya hay una restauración pgBackRest en curso',
          job: restoreJob,
        })
      }

      console.log(
        `[backup-worker] Restauración aceptada (async)${body.set ? ` set=${body.set}` : ''}`
      )
      setImmediate(() => {
        runRestoreJob(body).catch(err => {
          console.error('[backup-worker] runRestoreJob no capturado:', err)
        })
      })

      return json(res, 202, {
        accepted: true,
        async: true,
        message:
          'Restauración iniciada. El sitio quedará fuera de línea unos minutos mientras se restaura el cluster.',
        job: { status: 'running', label: body.set || null, startedAt: new Date().toISOString() },
      })
    }

    if (url.pathname === '/restore/status' && req.method === 'GET') {
      return json(res, 200, { job: restoreJob })
    }

    if (url.pathname === '/disk-usage' && req.method === 'GET') {
      try {
        // Medir espacio del disco donde está el repo de pgBackRest
        const repoPath = '/var/lib/pgbackrest'
        const { stdout } = await exec('df', ['-k', repoPath], { timeout: 10_000, env: process.env })
        // Formato: Filesystem 1K-blocks Used Available Use% Mounted
        const lines = stdout.toString().trim().split('\n')
        const parts = lines[lines.length - 1].trim().split(/\s+/)
        const totalBytes     = parseInt(parts[1], 10) * 1024
        const usedTotal      = parseInt(parts[2], 10) * 1024
        const availableBytes = parseInt(parts[3], 10) * 1024
        const usagePercent   = totalBytes > 0 ? Math.round((usedTotal / totalBytes) * 10000) / 100 : 0

        // Espacio usado SOLO por el repo de pgBackRest (los backups en sí)
        let repoUsedBytes = 0
        try {
          const { stdout: duOut } = await exec('du', ['-sk', repoPath], { timeout: 30_000, env: process.env })
          repoUsedBytes = parseInt(duOut.toString().trim().split(/\s+/)[0], 10) * 1024
        } catch {
          // du no disponible — usar el valor total del df como referencia
          repoUsedBytes = usedTotal
        }

        return json(res, 200, {
          repoPath,
          totalBytes,
          usedBytes: usedTotal,
          availableBytes,
          repoUsedBytes,
          usagePercent,
          status: usagePercent >= 90 ? 'critical' : usagePercent >= 75 ? 'warning' : 'healthy',
        })
      } catch (error) {
        return json(res, 500, {
          error: error instanceof Error ? error.message : 'Error obteniendo uso de disco',
        })
      }
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
  console.log('[backup-worker] Restauración pgBackRest: modo asíncrono (HTTP 202)')
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
