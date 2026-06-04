/**
 * Sincroniza el esquema de Payload contra la BD Postgres usando drizzle push.
 *
 * Payload solo ejecuta el `pushDevSchema` cuando `NODE_ENV !== 'production'`,
 * así que aquí forzamos `NODE_ENV=development` SOLO durante la sincronización
 * inicial del esquema en staging. La forma "correcta" en producción son
 * migraciones (`payload migrate:create` + `payload migrate`), pero para
 * staging y testing rápido este atajo nos ahorra el ciclo de generar archivos
 * de migración a mano.
 *
 * Uso (one-off dyno en Heroku):
 *   heroku run:detached --app tilestudio-staging "npm run db:push"
 *   heroku logs --app tilestudio-staging --dyno run.XXXX
 */
;(process.env as Record<string, string>).NODE_ENV = 'development'

async function dropConflictingExtensionViews() {
  // Heroku Postgres viene con la extensión `pg_stat_statements` instalada por
  // defecto, que crea las views `pg_stat_statements` y
  // `pg_stat_statements_info` en el schema `public`. Drizzle-kit hace diff
  // contra el schema de Payload y, como esas views no aparecen ahí, intenta
  // tirarlas → falla porque dependen de la extensión.
  //
  // Solución: dropeamos la extensión antes del push (eso quita las views
  // limpiamente) y la recreamos después. Es una extensión solo de
  // observabilidad, no afecta a la app.
  const { Client } = await import('pg')
  const uri = process.env.DATABASE_URL || process.env.DATABASE_URI
  if (!uri || !uri.startsWith('postgres')) return
  const client = new Client({
    connectionString: uri,
    ssl: uri.includes('localhost') ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    console.log('[db-push] Quitando extension pg_stat_statements (si existe)…')
    await client.query('DROP EXTENSION IF EXISTS pg_stat_statements CASCADE')
  } finally {
    await client.end()
  }
}

async function restoreExtensions() {
  const { Client } = await import('pg')
  const uri = process.env.DATABASE_URL || process.env.DATABASE_URI
  if (!uri || !uri.startsWith('postgres')) return
  const client = new Client({
    connectionString: uri,
    ssl: uri.includes('localhost') ? false : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    console.log('[db-push] Recreando extension pg_stat_statements…')
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements')
  } catch (err) {
    // No es crítico — si el usuario no tiene permisos, seguimos.
    console.warn('[db-push] No se pudo recrear pg_stat_statements:', (err as Error).message)
  } finally {
    await client.end()
  }
}

async function main() {
  await dropConflictingExtensionViews()

  // Import dinámico DESPUÉS de pisar NODE_ENV para que el adapter de Postgres
  // detecte "dev" y ejecute pushDevSchema en connect().
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

  console.log('[db-push] Inicializando Payload y empujando schema a Postgres…')
  const payload = await getPayload({ config })
  console.log('[db-push] Schema sincronizado.')

  // Cerramos conexiones limpiamente (destroy puede existir según adapter).
  const db = payload.db as unknown as { destroy?: () => Promise<void> }
  if (typeof db.destroy === 'function') {
    await db.destroy()
  }

  await restoreExtensions()

  process.exit(0)
}

main().catch((err) => {
  console.error('[db-push] Error sincronizando schema:', err)
  process.exit(1)
})
