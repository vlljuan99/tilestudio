import { headers } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { CandidateReview, type DuplicateInfo } from '@/components/admin-pdf/CandidateReview'

export const metadata = { title: 'Revisar candidatos', robots: { index: false } }

/** Misma normalización que la fusión de candidatos: sin diacríticos, minúsculas. */
function nameKey(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/admin/login')

  let importDoc: any
  try {
    importDoc = await payload.findByID({ collection: 'pdf-imports', id, depth: 1 })
  } catch {
    notFound()
  }
  if (!importDoc) notFound()

  // Duplicados: candidatos cuyo nombre ya existe como Tile en el catálogo.
  // Se comparan nombres normalizados (los dos lados salen del mismo pipeline).
  // Los candidatos ya publicados desde ESTE import (publishedTileId) no cuentan.
  const items: any[] = Array.isArray(importDoc.extractedItems) ? importDoc.extractedItems : []
  const duplicates: Record<string, DuplicateInfo> = {}
  if (items.length > 0) {
    const tiles = await payload.find({
      collection: 'tiles',
      limit: 5000,
      depth: 0,
      sort: 'id',
    })
    const byName = new Map<string, { id: number | string; name: string }>()
    for (const t of tiles.docs as any[]) {
      const key = nameKey(t.name)
      if (key && !byName.has(key)) byName.set(key, { id: t.id, name: t.name })
    }
    for (const c of items) {
      if (c.publishedTileId != null) continue
      const match = byName.get(nameKey(c.variantName))
      if (match) duplicates[c.id] = { tileId: match.id, tileName: match.name }
    }
  }

  return <CandidateReview importId={id} importDoc={importDoc} duplicates={duplicates} />
}
