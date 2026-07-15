import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { AmbientForm, type AmbientFormValues } from '@/components/ventas/AmbientForm'

export const metadata = { title: 'Editar ambiente' }

export default async function EditarAmbientePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })

  let doc: any
  try {
    doc = await payload.findByID({ collection: 'ambients', id, depth: 2 })
  } catch {
    notFound()
  }
  if (!doc) notFound()

  const image =
    doc.image && typeof doc.image === 'object'
      ? { id: doc.image.id, url: doc.image.url || '' }
      : null

  const initial: AmbientFormValues = {
    id: doc.id,
    title: doc.title || '',
    description: doc.description || '',
    image,
    tilesUsed: (doc.tilesUsed || [])
      .filter((t: any) => t?.tile)
      .map((t: any) => {
        const tile = typeof t.tile === 'object' ? t.tile : { id: t.tile, name: `#${t.tile}` }
        const tileImage = tile.mainImage && typeof tile.mainImage === 'object' ? tile.mainImage : null
        return {
          tile: tile.id,
          tileName: tile.name,
          tileImageUrl: tileImage?.url || null,
          surface: t.surface || 'floor',
        }
      }),
    roomType:
      doc.roomType == null ? null : typeof doc.roomType === 'object' ? doc.roomType.id : doc.roomType,
    style: doc.style || '',
    published: Boolean(doc.published),
  }

  return <AmbientForm initial={initial} />
}
