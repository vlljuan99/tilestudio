/**
 * Inspección rápida de la BD: cuántas filas hay en las tablas críticas.
 * Uso: heroku run:detached --app tilestudio-staging "npm run db:check"
 */
import { Client } from 'pg'

async function main() {
  const uri = process.env.DATABASE_URL || process.env.DATABASE_URI
  if (!uri) {
    console.error('No DATABASE_URL')
    process.exit(1)
  }
  const client = new Client({
    connectionString: uri,
    ssl: uri.includes('localhost') ? false : { rejectUnauthorized: false },
  })
  await client.connect()

  for (const table of ['users', 'tiles', 'media', 'leads', 'globals_site_settings']) {
    try {
      const r = await client.query(`SELECT COUNT(*)::int AS n FROM "${table}"`)
      console.log(`[db-check] ${table}: ${r.rows[0].n}`)
    } catch (err) {
      console.log(`[db-check] ${table}: ERROR — ${(err as Error).message}`)
    }
  }

  // Si hay users, lista emails (para limpiar si hace falta)
  try {
    const r = await client.query(`SELECT id, email FROM "users" LIMIT 10`)
    if (r.rows.length) {
      console.log('[db-check] usuarios existentes:')
      r.rows.forEach((row) => console.log(`  - id=${row.id} email=${row.email}`))
    }
  } catch {}

  await client.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[db-check] error:', err)
  process.exit(1)
})
