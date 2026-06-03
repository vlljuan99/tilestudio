/**
 * Publica al público todos los Tiles que vinieron de un import PDF (published=false).
 * Uso: npx tsx --env-file=.env src/scripts/publish-imported.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tiles',
    where: { published: { equals: false } },
    limit: 200,
    depth: 0,
  })
  console.log(`Encontrados ${res.docs.length} tiles no publicados.`)
  for (const t of res.docs as any[]) {
    await payload.update({
      collection: 'tiles',
      id: t.id,
      data: { published: true } as any,
    })
    console.log(`  ✓ ${t.name} publicado`)
  }
  console.log('Listo.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
