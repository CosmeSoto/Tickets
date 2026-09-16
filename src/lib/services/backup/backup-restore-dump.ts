import { exec } from 'child_process'
import { promisify } from 'util'
import { unlink } from 'fs/promises'
import prisma from '@/lib/prisma'
import type { RestoreMode } from './backup-restore'
import { MERGE_UPDATE_TABLES, TABLE_PK_MAP } from './backup-restore-merge-rules'
import {
  TICKETS_MODULE_RESTORE_ORDER,
  NEWS_MODULE_RESTORE_ORDER,
  PATROLS_MODULE_RESTORE_ORDER,
  FAMILIES_MODULE_RESTORE_ORDER,
  AUDITS_MODULE_RESTORE_ORDER,
  CONFIGURATIONS_MODULE_RESTORE_ORDER,
  USERS_MODULE_RESTORE_ORDER,
  CREDENTIALS_MODULE_RESTORE_ORDER,
  INVENTORY_MODULE_RESTORE_ORDER,
  PROCESSES_MODULE_RESTORE_ORDER,
  ACCESS_MODULE_RESTORE_ORDER,
  FORMS_MODULE_RESTORE_ORDER,
} from '../backup-modules'

const execAsync = promisify(exec)

function getTablesForModules(modules: string[]): string[] {
  const moduleTableMap: Record<string, readonly string[]> = {
    tickets: TICKETS_MODULE_RESTORE_ORDER,
    news: NEWS_MODULE_RESTORE_ORDER,
    patrols: PATROLS_MODULE_RESTORE_ORDER,
    families: FAMILIES_MODULE_RESTORE_ORDER,
    audits: AUDITS_MODULE_RESTORE_ORDER,
    configurations: CONFIGURATIONS_MODULE_RESTORE_ORDER,
    users: USERS_MODULE_RESTORE_ORDER,
    inventory: INVENTORY_MODULE_RESTORE_ORDER,
    // Secretos viajan cifrados (secretEncrypted); no hay plaintext en el dump filtrado.
    credentials: CREDENTIALS_MODULE_RESTORE_ORDER,
    processes: PROCESSES_MODULE_RESTORE_ORDER,
    access: ACCESS_MODULE_RESTORE_ORDER,
    forms: FORMS_MODULE_RESTORE_ORDER,
  }

  const tables: string[] = []
  for (const mod of modules) {
    const modTables = moduleTableMap[mod]
    if (modTables) {
      tables.push(...modTables)
    }
  }
  return [...new Set(tables)]
}

/**
 * Convierte bloques COPY de pg_dump a sentencias INSERT ... ON CONFLICT DO NOTHING.
 *
 * pg_dump custom exportado con -f - produce:
 *   COPY public."tabla" (col1, col2, ...) FROM stdin;
 *   val1\tval2\t...
 *   \.
 *
 * Esta función transforma cada fila en:
 *   INSERT INTO public."tabla" (col1, col2, ...) VALUES ($1, $2, ...) ON CONFLICT DO NOTHING;
 *
 * Los valores NULL se convierten desde \N (representación pg_dump).
 * Los valores con caracteres especiales se escapan correctamente.
 */
function convertCopyToInsertOnConflict(sql: string): string {
  const output: string[] = []

  // Pre-procesar: unir líneas de continuación del header COPY.
  // pg_restore con -f - puede partir líneas largas, por ejemplo:
  //   COPY public.users (id, email, "passwordHash", "departmentId",
  //    phone, ...) FROM stdin;
  // Necesitamos que quede en una sola línea para que el regex funcione.
  const rawLines = sql.split('\n')
  const lines: string[] = []
  for (let j = 0; j < rawLines.length; j++) {
    const l = rawLines[j]
    // Si la línea anterior empezó con COPY y aún no terminó con "FROM stdin;"
    // o si esta línea es continuación de un COPY (empieza con espacio y no es datos)
    if (
      lines.length > 0 &&
      lines[lines.length - 1].match(/^COPY\s/i) &&
      !lines[lines.length - 1].match(/FROM\s+stdin\s*;$/i)
    ) {
      // Línea de continuación del header COPY — unirla a la anterior
      lines[lines.length - 1] = lines[lines.length - 1].trimEnd() + ' ' + l.trim()
    } else {
      lines.push(l)
    }
  }

  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Detectar inicio de bloque COPY
    // Formato: COPY [public.]"tabla" (col1, col2, ...) FROM stdin;
    const copyMatch = line.match(
      /^COPY\s+(?:public\.)?("?[\w]+"?)\s*\(([^)]+)\)\s+FROM\s+stdin\s*;/i
    )

    if (copyMatch) {
      const tableName = copyMatch[1]
      const columnsPart = copyMatch[2]
      const columns = columnsPart.split(',').map(c => c.trim())

      // Determinar si esta tabla debe hacer UPDATE en conflicto
      const tableKey = tableName
        .replace(/"/g, '')
        .replace(/^public\./i, '')
        .toLowerCase()
      const shouldUpdate =
        MERGE_UPDATE_TABLES.has(tableName) ||
        MERGE_UPDATE_TABLES.has(`"${tableKey}"`) ||
        MERGE_UPDATE_TABLES.has(tableKey)

      // Para UPDATE: generar SET de todos los campos excepto la(s) columna(s) PK
      const pkCol = TABLE_PK_MAP[tableKey] ?? 'id'
      // Extraer las columnas PK para excluirlas del SET (pueden ser compuestas: "col1", col2)
      const pkCols = new Set(pkCol.split(',').map(c => c.trim().replace(/"/g, '').toLowerCase()))
      const updateCols = columns
        .filter(c => !pkCols.has(c.replace(/"/g, '').toLowerCase()))
        .map(c => `${c}=EXCLUDED.${c}`)
        .join(', ')

      i++ // avanzar a la primera fila de datos

      while (i < lines.length) {
        const dataLine = lines[i]

        // Fin del bloque COPY
        if (dataLine === '\\.') {
          i++
          break
        }

        // Parsear valores tab-separated
        const rawValues = dataLine.split('\t')

        // Si el número de valores no coincide con las columnas, la fila está corrupta — omitir
        if (rawValues.length !== columns.length) {
          console.warn(
            `[RESTORE] Fila omitida en ${tableName}: esperaba ${columns.length} cols, obtuvo ${rawValues.length}. Inicio: ${dataLine.substring(0, 60)}`
          )
          i++
          continue
        }

        const sqlValues = rawValues.map(v => {
          if (v === '\\N') return 'NULL'
          // Escapar comillas simples y backslashes
          const escaped = v.replace(/\\/g, '\\\\').replace(/'/g, "''")
          return `'${escaped}'`
        })

        const colList = columns.join(', ')
        const valList = sqlValues.join(', ')

        const conflictClause = shouldUpdate
          ? `ON CONFLICT (${pkCol}) DO UPDATE SET ${updateCols}`
          : `ON CONFLICT DO NOTHING`

        output.push(`INSERT INTO ${tableName} (${colList}) VALUES (${valList}) ${conflictClause};`)

        i++
      }
    } else {
      // Líneas que no son COPY (comentarios, SET, etc.) — conservar,
      // pero filtrar el set_config de search_path que resetearía el esquema
      if (
        line.trim() &&
        !line.startsWith('--') &&
        !line.includes('set_config(') &&
        !line.startsWith('\\restrict') &&
        !line.startsWith('\\unrestrict')
      ) {
        output.push(line)
      }
      i++
    }
  }

  return output.join('\n')
}

/**
 * Motor de restauración para respaldos en formato `.dump` (pg_dump custom).
 * Completa (sin `restoreModules`) o selectiva por módulo, en modo `replace`
 * o `merge` — ver comentarios inline en cada rama para el porqué de cada
 * decisión (son el resultado de varios bugs reales ya corregidos).
 */
export async function restoreWithPgRestore(
  filepath: string,
  dbConfig: { host: string; port: string; database: string; username: string; password: string },
  restoreModules?: string[],
  mode: RestoreMode = 'replace'
): Promise<void> {
  if (restoreModules?.length) {
    const tables = getTablesForModules(restoreModules)
    console.log(
      `[RESTORE] Restauración selectiva (${mode}): ${tables.length} tablas de módulo(s) [${restoreModules.join(', ')}]`
    )

    if (mode === 'replace') {
      // Modo reemplazo: DELETE + reinsertar datos del backup.
      //
      // PROBLEMA ANTERIOR (v1): el TRUNCATE y el INSERT se ejecutaban en dos invocaciones
      // psql separadas. El TRUNCATE usaba CASCADE (que borraba también audit_logs y otras
      // tablas dependientes), y el INSERT se hacía en una nueva sesión donde
      // session_replication_role ya había vuelto a DEFAULT → las FKs volvían a estar
      // activas → error "Foreign key constraint violated: audit_logs_userId_fkey".
      //
      // PROBLEMA ANTERIOR (v2): se unificó todo en una sola sesión con FKs desactivadas,
      // pero se mantuvo TRUNCATE ... CASCADE. Postgres exige CASCADE (o error) para
      // truncar una tabla referenciada por FK desde otra — pero CASCADE vacía también
      // esas tablas dependientes, sin importar si pertenecen a otro módulo no
      // seleccionado para esta restauración. Ejemplo real: restaurar solo "tickets"
      // vaciaba en cascada sla_violations, ticket_sla_metrics, maintenance_records y
      // patrol_incidents (todas con FK hacia tickets) y esas tablas nunca se
      // reinsertaban por no pertenecer al módulo — pérdida de datos silenciosa,
      // contradiciendo el aviso de la UI de que "las demás tablas no se ven afectadas".
      //
      // SOLUCIÓN: usar DELETE en vez de TRUNCATE. La restricción de "no se puede truncar,
      // referenciada por FK" es una verificación propia de TRUNCATE; DELETE no la tiene.
      // Con session_replication_role = replica ya activo, los triggers de FK (incluida
      // la verificación de referencias) se saltan durante el DELETE, así que no hace
      // falta CASCADE y las tablas de otros módulos quedan intactas. Cualquier fila que
      // quedara con una FK "colgante" hacia un id borrado se auto-repara segundos
      // después, cuando el propio bloque reinserta esas filas con los mismos IDs del
      // dump. Un único archivo SQL, en orden:
      //   1. SET session_replication_role = replica  (desactiva FKs para toda la sesión)
      //   2. SET search_path = public
      //   3. DELETE FROM ...  (limpia solo las tablas del módulo seleccionado)
      //   4. SQL de datos del dump (COPY o INSERT)
      //   5. SET session_replication_role = DEFAULT  (reactiva FKs)
      // y ejecutarlo con un solo "psql -f archivo.sql" para que todo ocurra
      // dentro de la misma sesión y las FKs estén desactivadas durante todo el proceso.

      const tableFlags = tables.map(t => `--table="${t}"`).join(' ')
      const dumpSqlCmd = `pg_restore --data-only --no-owner --no-privileges -f - ${tableFlags} "${filepath}"`

      let dumpSqlContent: string
      try {
        const { stdout } = await execAsync(dumpSqlCmd, {
          timeout: 300000,
          maxBuffer: 1024 * 1024 * 200,
        })
        dumpSqlContent = stdout
      } catch (dumpErr: any) {
        if (dumpErr.stdout && dumpErr.stdout.length > 0) {
          dumpSqlContent = dumpErr.stdout
        } else {
          throw new Error(
            `No se pudo extraer SQL del dump: ${(dumpErr as Error).message?.slice(0, 200)}`
          )
        }
      }

      if (!dumpSqlContent || dumpSqlContent.trim().length === 0) {
        throw new Error('El dump no generó contenido SQL para las tablas seleccionadas')
      }

      // Construir el script completo en un único archivo:
      // header con FK off → DELETE → datos → FK on
      const deleteSQL = tables.map(t => `DELETE FROM "${t}";`).join('\n')
      const fullScript = [
        '-- Restauración selectiva modo replace',
        '-- FKs desactivadas durante todo el bloque para evitar constraint violations',
        'SET session_replication_role = replica;',
        'SET search_path = public;',
        '',
        '-- Limpiar solo las tablas del módulo seleccionado (DELETE, no TRUNCATE CASCADE:',
        '-- no arrastra tablas de otros módulos que referencian estas por FK)',
        deleteSQL,
        '',
        '-- Datos del backup',
        dumpSqlContent,
        '',
        '-- Reactivar FKs',
        'SET session_replication_role = DEFAULT;',
      ].join('\n')

      const tempReplacePath = `${filepath}.replace_temp.sql`
      const { writeFile: writeF } = await import('fs/promises')
      try {
        await writeF(tempReplacePath, fullScript, 'utf-8')

        // Un único psql -f ejecuta todo en la misma sesión
        const replaceCmd =
          `PGPASSWORD="${dbConfig.password}" psql ` +
          `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
          `-v ON_ERROR_STOP=0 ` +
          `-f "${tempReplacePath}" 2>&1 || true`

        const { stdout } = await execAsync(replaceCmd, {
          timeout: 600000,
          maxBuffer: 1024 * 1024 * 50,
        })

        if (stdout) {
          const lines = stdout.split('\n')
          const errors = lines.filter(l => l.includes('ERROR'))
          const criticalErrors = errors.filter(
            e =>
              !e.includes('does not exist') &&
              !e.includes('already exists') &&
              !e.includes('duplicate key')
          )
          if (criticalErrors.length > 0) {
            console.warn('[RESTORE] Errores en replace:', criticalErrors.slice(0, 5).join('\n'))
          } else {
            console.log('[RESTORE] Replace completado sin errores críticos')
          }
        }
      } finally {
        try {
          await unlink(tempReplacePath)
        } catch {}
      }
    } else {
      // Modo merge: insertar solo registros nuevos, ignorar duplicados (ON CONFLICT DO NOTHING)
      // IMPORTANTE: pg_dump custom genera sentencias COPY, no INSERT.
      // Estrategia correcta:
      //   1. Extraer el SQL con pg_restore -f - (produce COPY ... FROM stdin)
      //   2. Convertir cada bloque COPY a INSERTs individuales con ON CONFLICT DO NOTHING
      //   3. Ejecutar con FKs desactivadas temporalmente
      const tempSqlPath = `${filepath}.merge_temp.sql`
      const tableFlags = tables.map(t => `--table="${t}"`).join(' ')

      try {
        // 1. Extraer SQL del dump a stdout (produce sentencias COPY, no INSERT)
        const dumpSqlCmd =
          `pg_restore --data-only --no-owner --no-privileges -f - ` + `${tableFlags} "${filepath}"`

        let sqlContent: string
        try {
          const { stdout } = await execAsync(dumpSqlCmd, {
            timeout: 300000,
            maxBuffer: 1024 * 1024 * 200,
          })
          sqlContent = stdout
        } catch (dumpErr: any) {
          // pg_restore retorna exit code != 0 si hay warnings — usar stdout si hay contenido
          if (dumpErr.stdout && dumpErr.stdout.length > 0) {
            sqlContent = dumpErr.stdout
          } else {
            throw new Error(
              `No se pudo extraer SQL del dump: ${(dumpErr as Error).message?.slice(0, 200)}`
            )
          }
        }

        if (!sqlContent || sqlContent.trim().length === 0) {
          throw new Error('El dump no generó contenido SQL para las tablas seleccionadas')
        }

        // 2. Convertir bloques COPY a INSERTs con ON CONFLICT DO NOTHING
        // El formato COPY de pg_dump es:
        //   COPY public."tabla" (col1, col2, ...) FROM stdin;
        //   val1\tval2\t...
        //   \.
        const mergedSql = convertCopyToInsertOnConflict(sqlContent)

        if (!mergedSql || mergedSql.trim().length === 0) {
          throw new Error(
            'No se pudo convertir el contenido del dump a sentencias INSERT. ' +
              'Verifica que el dump contenga datos para las tablas seleccionadas.'
          )
        }

        const { writeFile: writeF } = await import('fs/promises')
        await writeF(tempSqlPath, mergedSql, 'utf-8')

        // 3. Ejecutar el SQL modificado desactivando FKs temporalmente vía session_replication_role
        // IMPORTANTE: el dump incluye "SET search_path = ''" que hace que las tablas sin prefijo
        // de esquema no se encuentren. Forzamos search_path = public antes de ejecutar el archivo.
        const mergeCmd =
          `PGPASSWORD="${dbConfig.password}" psql ` +
          `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
          `-v ON_ERROR_STOP=0 ` +
          `-c "SET session_replication_role = replica; SET search_path = public;" ` +
          `-f "${tempSqlPath}" ` +
          `-c "SET session_replication_role = DEFAULT;" 2>&1 || true`

        const { stdout: mergeOut } = await execAsync(mergeCmd, {
          timeout: 600000,
          maxBuffer: 1024 * 1024 * 50,
        })

        if (mergeOut) {
          const lines = mergeOut.split('\n')
          const errors = lines.filter(l => l.includes('ERROR'))
          const criticalErrors = errors.filter(
            e =>
              !e.includes('does not exist') &&
              !e.includes('already exists') &&
              !e.includes('duplicate key') &&
              !e.includes('ON CONFLICT')
          )
          if (criticalErrors.length > 0) {
            console.warn('[RESTORE] Errores en merge:', criticalErrors.slice(0, 5).join('\n'))
          }
          // Contar inserciones exitosas para logging
          const insertCount = lines.filter(l => l.trim() === 'INSERT 0 1').length
          const skippedCount = lines.filter(l => l.trim() === 'INSERT 0 0').length
          console.log(
            `[RESTORE] Merge: ${insertCount} insertados, ${skippedCount} ya existían (omitidos), ${errors.length} errores`
          )
          if (mergeOut.trim()) {
            console.log(`[RESTORE] psql output: ${mergeOut.trim().substring(0, 800)}`)
          }
        }

        console.log(`[RESTORE] Merge completado para tablas: ${tables.join(', ')}`)
      } finally {
        try {
          await unlink(tempSqlPath)
        } catch {}
      }
    }

    console.log(`[RESTORE] Restauración selectiva (${mode}) completada: ${tables.length} tablas`)

    // Restore parcial puede dejar familyId huérfanos; limpieza genérica (sin seed).
    try {
      const { repairOrphanFamilyForeignKeys } =
        await import('@/lib/data-integrity/repair-orphan-family-fks')
      const stats = await repairOrphanFamilyForeignKeys(prisma)
      if (
        stats.departmentsCleared > 0 ||
        stats.assignmentsDeleted > 0 ||
        stats.technologyRemapped > 0
      ) {
        console.log(
          `[RESTORE] Integridad familias: depts limpiados=${stats.departmentsCleared}, asignaciones eliminadas=${stats.assignmentsDeleted}, TECHNOLOGY remapeada=${stats.technologyRemapped}`
        )
      }
    } catch (err) {
      console.warn('[RESTORE] No se pudo reparar FKs de familias tras restore:', err)
    }

    // Reparar tickets cuyo categoryId apunta a categorías que ya no existen.
    // Se reasignan a la primera categoría activa disponible para que el dashboard
    // y otras queries con include:categories no lancen PrismaClientUnknownRequestError.
    try {
      const fallbackCategory = await prisma.categories.findFirst({
        where: { isActive: true },
        orderBy: { level: 'asc' },
        select: { id: true, name: true },
      })

      if (fallbackCategory) {
        const fixed = await prisma.$executeRawUnsafe(
          `
          UPDATE tickets t
          SET "categoryId" = $1, "updatedAt" = NOW()
          WHERE NOT EXISTS (
            SELECT 1 FROM categories c WHERE c.id = t."categoryId"
          )
        `,
          fallbackCategory.id
        )

        if (Number(fixed) > 0) {
          console.log(
            `[RESTORE] Integridad tickets: ${Number(fixed)} ticket(s) con categoryId huérfano reasignados a "${fallbackCategory.name}"`
          )
        }
      } else {
        // Sin categoría de respaldo — eliminar tickets huérfanos sería peligroso,
        // solo logueamos para que el administrador lo resuelva manualmente.
        const orphanCount = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
          `SELECT COUNT(*) as count FROM tickets t
           WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = t."categoryId")`
        )
        const n = Number(orphanCount[0]?.count ?? 0)
        if (n > 0) {
          console.warn(
            `[RESTORE] ADVERTENCIA: ${n} ticket(s) con categoryId huérfano. No hay categoría de respaldo disponible.`
          )
        }
      }
    } catch (err) {
      console.warn('[RESTORE] No se pudo reparar categoryId huérfano en tickets:', err)
    }

    // Reparar technician_assignments cuyo categoryId apunta a una categoría que
    // ya no existe (categories.id no es determinista entre reseeds — ver
    // cleanupOrphanedForeignKeys). categoryId es NOT NULL ahí, así que a
    // diferencia de tickets no hay "categoría de respaldo" razonable: la fila
    // es la asignación categoría↔técnico, sin sentido sin su categoría. Dejarla
    // huérfana rompe cualquier include de esa relación (p. ej. GET /api/users
    // ?purpose=categoryResolvers), lo que termina mostrando "0 técnicos
    // disponibles" en el selector de resolutores de categorías.
    try {
      const deleted = await prisma.$executeRawUnsafe(`
        DELETE FROM technician_assignments t
        WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.id = t."categoryId")
      `)
      if (Number(deleted) > 0) {
        console.log(
          `[RESTORE] Integridad technician_assignments: ${Number(deleted)} asignación(es) con categoryId huérfano eliminada(s)`
        )
      }
    } catch (err) {
      console.warn(
        '[RESTORE] No se pudo reparar categoryId huérfano en technician_assignments:',
        err
      )
    }
  } else {
    // Restauración completa — el modo merge no aplica a nivel completo (demasiado riesgo de inconsistencias)
    const command =
      `PGPASSWORD="${dbConfig.password}" pg_restore ` +
      `-h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} ` +
      `--clean --if-exists --no-owner --no-privileges --single-transaction ` +
      `"${filepath}" 2>&1 || true`
    console.log('[RESTORE] Ejecutando restauración completa con pg_restore...')
    const { stdout } = await execAsync(command, {
      timeout: 600000,
      maxBuffer: 1024 * 1024 * 50,
    })
    if (stdout && stdout.includes('ERROR')) {
      const errors = stdout.split('\n').filter(l => l.includes('ERROR'))
      const criticalErrors = errors.filter(
        e => !e.includes('does not exist') && !e.includes('already exists')
      )
      if (criticalErrors.length > 0) {
        // pg_restore corre con --single-transaction: un error real aquí
        // (ej. "cannot drop table ... because other objects depend on it",
        // típico cuando una tabla agregada después del dump tiene una FK
        // viva hacia una tabla que el dump viejo sí trae) aborta TODA la
        // transacción — Postgres hace rollback completo y la restauración
        // no aplicó nada. Antes esto solo se registraba con console.warn y
        // el flujo seguía como si hubiera tenido éxito (incluso corriendo
        // `prisma db push` después), reportando "restauración completada"
        // al admin sobre una base de datos que en realidad no cambió.
        const summary = criticalErrors.slice(0, 5).join('\n')
        console.error('[RESTORE] Errores críticos durante pg_restore:', summary)
        throw new Error(
          `La restauración completa falló: pg_restore reportó errores críticos y, al correr ` +
            `con --single-transaction, es probable que no se haya aplicado ningún cambio. ` +
            `Detalle: ${summary.slice(0, 500)}`
        )
      }
    }
    console.log('[RESTORE] Restauración completa finalizada')

    // Sincronizar schema tras restauración completa.
    // Un backup antiguo puede no incluir columnas nuevas (ej. can_manage_news).
    // prisma db push aplica solo los cambios faltantes sin borrar datos existentes.
    console.log('[RESTORE] Sincronizando schema con prisma db push...')
    try {
      const prismaCli = `node ./node_modules/prisma/build/index.js`
      const { stdout: pushOut } = await execAsync(`${prismaCli} db push --accept-data-loss 2>&1`, {
        timeout: 120000,
      })
      console.log('[RESTORE] Schema sincronizado correctamente:', pushOut.trim().slice(0, 500))
    } catch (pushErr) {
      // No lanzar error — la restauración fue exitosa, el push fallido es recuperable al reiniciar
      console.warn(
        '[RESTORE] Advertencia: db push falló tras restauración:',
        (pushErr as Error).message?.slice(0, 200)
      )
    }
  }
}
