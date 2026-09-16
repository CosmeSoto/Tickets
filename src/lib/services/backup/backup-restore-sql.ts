import { exec } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'

const execAsync = promisify(exec)

/** Motor de restauración para respaldos en formato `.sql` plano (siempre completa). */
export async function restoreFromSQL(backup: {
  id: string
  filename: string
  filepath: string
}): Promise<void> {
  console.log('[RESTORE] Iniciando restauración SQL...')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL no configurada')

  const url = new URL(databaseUrl)
  const dbConfig = {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.slice(1),
    username: url.username,
    password: url.password,
  }

  let sourceFile = backup.filepath

  if (backup.filepath.endsWith('.gz')) {
    console.log('[RESTORE] Descomprimiendo respaldo...')
    const decompressedPath = backup.filepath.replace('.gz', '')
    await execAsync(`gunzip -c "${backup.filepath}" > "${decompressedPath}"`)
    sourceFile = decompressedPath
  }

  console.log(`[RESTORE] Archivo de respaldo: ${sourceFile}`)
  console.log(`[RESTORE] Conectando a ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`)

  try {
    await execAsync('which psql')
    console.log('[RESTORE] psql está disponible')
    const command = `PGPASSWORD="${dbConfig.password}" psql -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${sourceFile}" --single-transaction`
    const { stderr, stdout } = await execAsync(command, {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 100,
    })
    if (stdout) console.log('[RESTORE] Salida:', stdout)
    if (stderr && !stderr.includes('NOTICE') && !stderr.includes('WARNING')) {
      console.warn('[RESTORE] Advertencias:', stderr)
    }
    console.log('[RESTORE] Restauración SQL completada exitosamente!')
  } catch (psqlError) {
    console.error('[RESTORE] Error con psql:', psqlError)
    throw new Error(
      'No se pudo restaurar el respaldo. Asegúrate de que el contenedor de la app tenga postgresql-client instalado. Si usas Docker, reconstruye el contenedor con: docker compose -f docker-compose.dev.yml up --build'
    )
  } finally {
    if (sourceFile !== backup.filepath) {
      try {
        await unlink(sourceFile)
      } catch {}
    }
  }
}
