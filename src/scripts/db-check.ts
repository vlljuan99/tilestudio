/**
 * Inspección rápida de la BD. Lista todas las tablas y filas en cada una.
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

  // Listar todas las tablas del schema public
  const tablesQ = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `)
  console.log(`[db-check] ${tablesQ.rows.length} tablas en schema 'public':`)
  for (const row of tablesQ.rows) {
    const tname = row.tablename as string
    try {
      const c = await client.query(`SELECT COUNT(*)::int AS n FROM "${tname}"`)
      console.log(`  - ${tname}: ${c.rows[0].n} filas`)
    } catch (err) {
      console.log(`  - ${tname}: ERROR (${(err as Error).message})`)
    }
  }

  // Si hay tabla users, dump emails
  try {
    const r = await client.query(`SELECT id, email FROM users LIMIT 5`)
    if (r.rows.length) {
      console.log('[db-check] users existentes:')
      r.rows.forEach((row) => console.log(`  - ${row.id}: ${row.email}`))
    } else {
      console.log('[db-check] users: tabla vacía (0 docs)')
    }
  } catch (err) {
    console.log('[db-check] users: tabla no existe o sin permisos')
  }

  await client.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('[db-check] error:', err)
  process.exit(1)
})
