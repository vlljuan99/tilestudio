import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { TileForm, type TileFormValues } from '@/components/ventas/TileForm'

export const metadata = { title: 'Editar azulejo' }

function mediaRef(field: any): { id: number | string; url: string } | null {
  if (field && typeof field === 'object' && field.id != null) {
    return { id: field.id, url: field.url || '' }
  }
  return null
}

function relId(field: any): number | string | null {
  if (field == null) return null
  return typeof field === 'object' ? field.id : field
}

function relIds(field: any): (number | string)[] {
  if (!Array.isArray(field)) return []
  return field.map(relId).filter((x): x is number | string => x != null)
}

export default async function EditarAzulejoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })

  let tile: any
  try {
    tile = await payload.findByID({ collection: 'tiles', id, depth: 1 })
  } catch {
    notFound()
  }
  if (!tile) notFound()

  const initial: TileFormValues = {
    id: tile.id,
    name: tile.name || '',
    sku: tile.sku || '',
    description: tile.description || '',
    mainImage: mediaRef(tile.mainImage),
    textureImage: mediaRef(tile.textureImage),
    brand: relId(tile.brand),
    collection: relId(tile.collection),
    format: relId(tile.format),
    finish: relId(tile.finish),
    colors: relIds(tile.colors),
    usages: relIds(tile.usages),
    rooms: relIds(tile.rooms),
    orientativePrice: tile.orientativePrice != null ? String(tile.orientativePrice) : '',
    priceUnit: tile.priceUnit || 'm2',
    published: Boolean(tile.published),
    featured: Boolean(tile.featured),
    aiReady: Boolean(tile.aiReady),
  }

  return <TileForm initial={initial} />
}
