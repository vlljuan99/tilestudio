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
 *   heroku run --app tilestudio-staging -- npm run db:push
 */
;(process.env as Record<string, string>).NODE_ENV = 'development'

async function main() {
  // Import dinámico DESPUÉS de pisar NODE_ENV para que el adapter de Postgres
  // detecte "dev" y ejecute pushDevSchema en connect().
  const { getPayload } = await import('payload')
  const { default: config } = await import('../payload.config')

  console.log('[db-push] Inicializando Payload y empujando schema a Postgres…')
  const payload = await getPayload({ config })
  console.log('[db-push] Schema sincronizado.')

  // Cerramos conexiones limpiamente.
  // @ts-expect-error — destroy existe en el adapter de drizzle pero no está tipado
  if (typeof payload.db.destroy === 'function') {
    // @ts-expect-error — igual
    await payload.db.destroy()
  }
  process.exit(0)
}

main().catch((err) => {
  console.error('[db-push] Error sincronizando schema:', err)
  process.exit(1)
})
