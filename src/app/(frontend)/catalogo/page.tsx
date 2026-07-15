import { getPayload } from 'payload'
import config from '@payload-config'

import { TileCard } from '@/components/catalog/TileCard'
import { CatalogFilters, type FacetGroup } from '@/components/catalog/CatalogFilters'
import { MobileFilters } from '@/components/catalog/MobileFilters'
import { CatalogSearch } from '@/components/catalog/CatalogSearch'
import { CatalogSort } from '@/components/catalog/CatalogSort'
import { CatalogPagination } from '@/components/catalog/CatalogPagination'

type SP = { [key: string]: string | string[] | undefined }

const PAGE_SIZE = 24

type Dimension = {
  urlKey: string
  label: string
  collection: 'colors' | 'formats' | 'finishes' | 'rooms' | 'usages' | 'collections'
  /** Campo correspondiente en el documento tile. */
  field: 'colors' | 'format' | 'finish' | 'rooms' | 'usages' | 'collection'
  swatches?: boolean
}

const DIMENSIONS: Dimension[] = [
  { urlKey: 'color', label: 'Color', collection: 'colors', field: 'colors', swatches: true },
  { urlKey: 'formato', label: 'Formato', collection: 'formats', field: 'format' },
  { urlKey: 'acabado', label: 'Acabado', collection: 'finishes', field: 'finish' },
  { urlKey: 'estancia', label: 'Estancia', collection: 'rooms', field: 'rooms' },
  { urlKey: 'uso', label: 'Uso', collection: 'usages', field: 'usages' },
  { urlKey: 'coleccion', label: 'Colección', collection: 'collections', field: 'collection' },
]

const SORTS: Record<string, string | string[]> = {
  '': ['-featured', '-createdAt'],
  novedades: '-createdAt',
  'precio-asc': 'orientativePrice',
  'precio-desc': '-orientativePrice',
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) || ''
}

function selectedSlugs(sp: SP, urlKey: string): string[] {
  return first(sp[urlKey]).split(',').filter(Boolean)
}

async function loadTaxonomies() {
  const payload = await getPayload({ config })
  const results = await Promise.all(
    DIMENSIONS.map((dim) =>
      payload.find({ collection: dim.collection, limit: 200, sort: 'name', depth: 0 }),
    ),
  )
  return DIMENSIONS.map((dim, i) => ({ dim, docs: results[i].docs as any[] }))
}

type Taxonomies = Awaited<ReturnType<typeof loadTaxonomies>>

/** Ids seleccionados por dimensión, resueltos de los slugs de la URL. */
function resolveSelected(sp: SP, taxonomies: Taxonomies) {
  const byField = new Map<string, string[]>()
  for (const { dim, docs } of taxonomies) {
    const slugs = selectedSlugs(sp, dim.urlKey)
    if (!slugs.length) continue
    const ids = docs.filter((d) => slugs.includes(d.slug)).map((d) => String(d.id))
    if (ids.length) byField.set(dim.field, ids)
  }
  return byField
}

function searchClause(q: string) {
  return {
    or: [
      { name: { contains: q } },
      { sku: { contains: q } },
      { description: { contains: q } },
    ],
  }
}

async function loadTiles(sp: SP, selected: Map<string, string[]>) {
  const payload = await getPayload({ config })

  const where: any = { and: [{ published: { equals: true } }] }
  const q = first(sp.q).trim()
  if (q) where.and.push(searchClause(q))
  for (const [field, ids] of selected) {
    where.and.push({ [field]: { in: ids } })
  }

  const page = Math.max(1, parseInt(first(sp.pagina), 10) || 1)
  const sort = SORTS[first(sp.orden)] ?? SORTS['']

  const result = await payload.find({
    collection: 'tiles',
    where,
    limit: PAGE_SIZE,
    page,
    depth: 1,
    sort,
  })
  return result
}

/**
 * Contadores de faceta: para cada opción, cuántos tiles quedarían al
 * seleccionarla, respetando la búsqueda y los filtros de las demás
 * dimensiones (dentro de una dimensión la selección es OR).
 */
async function buildFacets(sp: SP, taxonomies: Taxonomies): Promise<FacetGroup[]> {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'tiles',
    where: { published: { equals: true } },
    pagination: false,
    depth: 0,
    select: {
      name: true,
      sku: true,
      description: true,
      colors: true,
      format: true,
      finish: true,
      rooms: true,
      usages: true,
      collection: true,
    },
  })

  const q = first(sp.q).trim().toLowerCase()
  const docs = (res.docs as any[])
    .filter((doc) => {
      if (!q) return true
      return [doc.name, doc.sku, doc.description].some(
        (text) => typeof text === 'string' && text.toLowerCase().includes(q),
      )
    })
    .map((doc) => {
      const values = new Map<string, Set<string>>()
      for (const { dim } of taxonomies) {
        const raw = doc[dim.field]
        const ids = (Array.isArray(raw) ? raw : raw != null ? [raw] : []).map((v: any) =>
          String(typeof v === 'object' ? v?.id : v),
        )
        values.set(dim.field, new Set(ids))
      }
      return values
    })

  const selected = resolveSelected(sp, taxonomies)

  return taxonomies.map(({ dim, docs: options }) => {
    // Subconjunto que cumple los filtros de las OTRAS dimensiones.
    const otherDims = [...selected].filter(([field]) => field !== dim.field)
    const subset = docs.filter((values) =>
      otherDims.every(([field, ids]) => ids.some((id) => values.get(field)?.has(id))),
    )
    return {
      urlKey: dim.urlKey,
      label: dim.label,
      swatches: dim.swatches,
      options: options.map((opt) => ({
        slug: opt.slug,
        name: opt.name,
        hex: opt.hex ?? null,
        count: subset.filter((values) => values.get(dim.field)?.has(String(opt.id))).length,
      })),
    }
  })
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
  const taxonomies = await loadTaxonomies()
  const selected = resolveSelected(sp, taxonomies)
  const [result, facets] = await Promise.all([loadTiles(sp, selected), buildFacets(sp, taxonomies)])

  const tiles = result.docs as any[]
  const baseParams = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (key === 'pagina') continue
    const v = first(value)
    if (v) baseParams.set(key, v)
  }

  return (
    <div className="container py-8 md:py-12 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl">Catálogo</h1>
        <p className="text-muted-foreground">
          {result.totalDocs} {result.totalDocs === 1 ? 'azulejo' : 'azulejos'}
          {first(sp.q).trim() ? ` para “${first(sp.q).trim()}”` : ''}
        </p>
      </header>

      <div className="flex items-center gap-3">
        <CatalogSearch />
        <CatalogSort />
        <MobileFilters groups={facets} />
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10 lg:items-start">
        <aside className="hidden lg:block lg:sticky lg:top-24">
          <CatalogFilters groups={facets} />
        </aside>

        <div className="space-y-8">
          {tiles.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground space-y-3">
              <p>No hay azulejos que coincidan con tu búsqueda.</p>
              <a href="/catalogo" className="inline-block underline hover:text-foreground">
                Ver todo el catálogo
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
              {tiles.map((tile) => (
                <TileCard key={tile.id} tile={tile} />
              ))}
            </div>
          )}

          <CatalogPagination
            page={result.page || 1}
            totalPages={result.totalPages || 1}
            baseParams={baseParams}
          />
        </div>
      </div>
    </div>
  )
}
