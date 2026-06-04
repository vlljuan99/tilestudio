/**
 * Borra todos los tiles y limpia las referencias que los bloquean.
 * Uso: npx tsx --env-file=.env src/scripts/delete-all-tiles.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })

  // 1. Limpiar referencias en PdfImports.createdTiles
  const imports = await payload.find({ collection: 'pdf-imports', limit: 500, depth: 0 })
  for (const imp of imports.docs as any[]) {
    if (imp.createdTiles?.length) {
      await payload.update({
        collection: 'pdf-imports',
        id: imp.id,
        data: { createdTiles: [] } as any,
      })
      console.log(`  · vaciado createdTiles de import #${imp.id}`)
    }
  }

  // 2. Borrar todas las Generations (referencian tiles)
  const gens = await payload.find({ collection: 'generations', limit: 1000, depth: 0 })
  console.log(`  · borrando ${gens.docs.length} generaciones`)
  for (const g of gens.docs as any[]) {
    try {
      await payload.delete({ collection: 'generations', id: g.id })
    } catch (e) {
      console.warn(`    ✗ no se pudo borrar generation ${g.id}: ${(e as Error).message}`)
    }
  }

  // 3. Quitar tileOfInterest en Leads
  const leads = await payload.find({ collection: 'leads', limit: 1000, depth: 0 })
  for (const l of leads.docs as any[]) {
    if (l.tileOfInterest) {
      try {
        await payload.update({
          collection: 'leads',
          id: l.id,
          data: { tileOfInterest: null } as any,
        })
      } catch {}
    }
  }

  // 4. Quitar tile.collection.cover si apunta a un tile (no debería, pero por si acaso)

  // 5. Borrar todos los Tiles
  const tiles = await payload.find({ collection: 'tiles', limit: 1000, depth: 0 })
  console.log(`  · borrando ${tiles.docs.length} tiles`)
  let ok = 0
  let fail = 0
  for (const t of tiles.docs as any[]) {
    try {
      await payload.delete({ collection: 'tiles', id: t.id })
      ok++
    } catch (e) {
      fail++
      console.warn(`    ✗ ${t.name}: ${(e as Error).message}`)
    }
  }

  console.log(`\n✅ ${ok} tiles borrados. ${fail} fallaron.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
