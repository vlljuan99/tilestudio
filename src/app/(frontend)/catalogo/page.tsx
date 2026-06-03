import { getPayload } from 'payload'
import config from '@payload-config'

import { TileCard } from '@/components/catalog/TileCard'
import { CatalogFilters } from '@/components/catalog/CatalogFilters'

type SP = { [key: string]: string | string[] | undefined }

async function loadTaxonomies() {
  const payload = await getPayload({ config })
  const [colors, finishes, formats, rooms, usages, collections] = await Promise.all([
    payload.find({ collection: 'colors', limit: 100, sort: 'name' }),
    payload.find({ collection: 'finishes', limit: 100, sort: 'name' }),
    payload.find({ collection: 'formats', limit: 100, sort: 'name' }),
    payload.find({ collection: 'rooms', limit: 100, sort: 'name' }),
    payload.find({ collection: 'usages', limit: 100, sort: 'name' }),
    payload.find({ collection: 'collections', limit: 100, sort: 'name' }),
  ])
  return {
    colors: colors.docs as any[],
    finishes: finishes.docs as any[],
    formats: formats.docs as any[],
    rooms: rooms.docs as any[],
    usages: usages.docs as any[],
    collections: collections.docs as any[],
  }
}

async function lookupIdBySlug(collection: any, slug?: string) {
  if (!slug) return null
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
  })
  return res.docs[0]?.id ?? null
}

async function loadTiles(sp: SP) {
  const payload = await getPayload({ config })

  const [colorId, finishId, formatId, roomId, usageId, collectionId] = await Promise.all([
    lookupIdBySlug('colors', sp.color as string),
    lookupIdBySlug('finishes', sp.acabado as string),
    lookupIdBySlug('formats', sp.formato as string),
    lookupIdBySlug('rooms', sp.estancia as string),
    lookupIdBySlug('usages', sp.uso as string),
    lookupIdBySlug('collections', sp.coleccion as string),
  ])

  const where: any = { and: [{ published: { equals: true } }] }
  if (colorId) where.and.push({ colors: { in: [colorId] } })
  if (finishId) where.and.push({ finish: { equals: finishId } })
  if (formatId) where.and.push({ format: { equals: formatId } })
  if (roomId) where.and.push({ rooms: { in: [roomId] } })
  if (usageId) where.and.push({ usages: { in: [usageId] } })
  if (collectionId) where.and.push({ collection: { equals: collectionId } })

  const result = await payload.find({
    collection: 'tiles',
    where,
    limit: 48,
    depth: 1,
    sort: '-featured',
  })
  return result.docs as any[]
}

export const metadata = {
  title: 'Catálogo de azulejos',
  description: 'Explora todos los azulejos disponibles. Filtra por color, formato, acabado y más.',
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const sp = await searchParams
  const [taxonomies, tiles] = await Promise.all([loadTaxonomies(), loadTiles(sp)])

  return (
    <div className="container py-8 md:py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl">Catálogo</h1>
        <p className="text-muted-foreground">
          {tiles.length} {tiles.length === 1 ? 'azulejo' : 'azulejos'} encontrados.
        </p>
      </header>

      <CatalogFilters {...taxonomies} />

      {tiles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          No hay azulejos que coincidan con los filtros.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
          {tiles.map((tile) => (
            <TileCard key={tile.id} tile={tile} />
          ))}
        </div>
      )}
    </div>
  )
}
