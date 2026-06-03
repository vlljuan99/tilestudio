/**
 * Borra los Tiles importados desde PDF (los que tienen marca "Pamesa") y resetea
 * los PdfImports anteriores. Luego se puede volver a importar limpio.
 *
 * Uso: npx tsx --env-file=.env src/scripts/reset-pamesa.ts
 */
import { getPayload } from 'payload'
import config from '../payload.config'

async function main() {
  const payload = await getPayload({ config })

  // Encontrar la marca Pamesa
  const brandRes = await payload.find({
    collection: 'brands',
    where: { name: { equals: 'Pamesa' } },
    limit: 1,
  })
  const pamesa = (brandRes.docs[0] as any) || null
  if (!pamesa) {
    console.log('No hay marca Pamesa todavía. Nada que limpiar.')
    process.exit(0)
  }

  const tiles = await payload.find({
    collection: 'tiles',
    where: { brand: { equals: pamesa.id } },
    limit: 200,
    depth: 0,
  })
  console.log(`Encontrados ${tiles.docs.length} tiles de Pamesa.`)
  for (const t of tiles.docs as any[]) {
    await payload.delete({ collection: 'tiles', id: t.id })
    console.log(`  ✗ Borrado tile ${t.name}`)
  }

  // También borrar los PdfImports anteriores
  const imports = await payload.find({
    collection: 'pdf-imports',
    limit: 50,
  })
  console.log(`Encontrados ${imports.docs.length} PdfImports anteriores.`)
  for (const i of imports.docs as any[]) {
    await payload.delete({ collection: 'pdf-imports', id: i.id })
    console.log(`  ✗ Borrado import ${i.displayName || i.id}`)
  }

  console.log('Listo.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
