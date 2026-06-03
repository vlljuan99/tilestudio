import { getPayload } from 'payload'
import config from '../payload.config'

const payload = await getPayload({ config })

const tiles = await payload.count({ collection: 'tiles' })
const imports = await payload.find({ collection: 'pdf-imports', sort: '-createdAt', limit: 10 })

console.log('=== Estado actual ===')
console.log(`Tiles en DB: ${tiles.totalDocs}`)
console.log('PDF Imports:')
for (const d of imports.docs as any[]) {
  console.log(`  #${d.id} status=${d.status} candidatos=${d.candidatesCount ?? 0} createdAt=${d.createdAt}`)
}
