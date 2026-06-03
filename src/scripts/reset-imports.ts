/**
 * Limpia pdf-imports y tiles de la DB para hacer un volcado limpio.
 * Uso: npx tsx --env-file=.env src/scripts/reset-imports.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

const payload = await getPayload({ config })

const imports = await payload.find({ collection: 'pdf-imports', limit: 100 })
for (const doc of imports.docs) {
  await payload.delete({ collection: 'pdf-imports', id: doc.id })
}
console.log(`pdf-imports borrados: ${imports.docs.length}`)

const tiles = await payload.find({ collection: 'tiles', limit: 500 })
for (const doc of tiles.docs) {
  await payload.delete({ collection: 'tiles', id: doc.id })
}
console.log(`tiles borrados: ${tiles.docs.length}`)

console.log('Listo.')
process.exit(0)
