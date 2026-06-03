import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const maxDuration = 300

type Candidate = {
  id: string
  page: number
  brand?: string | null
  collection?: string | null
  seriesName?: string | null
  variantName: string
  sku?: string | null
  formats?: string[]
  finishes?: string[]
  dominantColor?: string | null
  description?: string | null
  usage?: string[]
  rooms?: string[]
  pageImageUrl?: string
  pageMediaId?: number | string
  ambientImageUrl?: string
  ambientMediaId?: number | string
  textureImageUrl?: string
  textureMediaId?: number | string
  reviewStatus: 'pending' | 'accepted' | 'rejected'
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80)
}

async function findOrCreateByName(
  payload: any,
  collection: string,
  name: string,
  extra: Record<string, any> = {},
) {
  if (!name) return null
  const slug = slugify(name)
  const existing = await payload.find({
    collection,
    where: { or: [{ slug: { equals: slug } }, { name: { equals: name } }] },
    limit: 1,
  })
  if (existing.docs[0]) return existing.docs[0]
  return payload.create({ collection, data: { name, slug, ...extra } })
}

async function uploadFromUrl(payload: any, url: string, name: string, alt: string) {
  const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`
  const res = await fetch(fullUrl)
  if (!res.ok) throw new Error(`No se pudo descargar ${fullUrl} (${res.status})`)
  const data = Buffer.from(await res.arrayBuffer())
  return payload.create({
    collection: 'media',
    data: { alt } as any,
    file: {
      name,
      data,
      mimetype: res.headers.get('content-type') || 'image/jpeg',
      size: data.length,
    },
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let importDoc: any
  try {
    importDoc = await payload.findByID({ collection: 'pdf-imports', id, depth: 1 })
  } catch {
    return NextResponse.json({ error: 'Import no encontrado.' }, { status: 404 })
  }

  const candidates: Candidate[] = importDoc.extractedItems || []
  const accepted = candidates.filter((c) => c.reviewStatus === 'accepted')

  if (accepted.length === 0) {
    return NextResponse.json({ error: 'No hay candidatos aceptados.' }, { status: 400 })
  }

  await payload.update({
    collection: 'pdf-imports',
    id,
    data: { status: 'importing', currentStep: `Publicando ${accepted.length} azulejos…` } as any,
  })

  // Marca: usar la del import si está, si no la detectada en candidatos
  let brandId: number | string | null = null
  if (importDoc.brand) {
    brandId = typeof importDoc.brand === 'object' ? importDoc.brand.id : importDoc.brand
  } else {
    const brandName = accepted.find((c) => c.brand)?.brand
    if (brandName) {
      const brand = await findOrCreateByName(payload, 'brands', brandName)
      brandId = brand?.id ?? null
    }
  }

  const createdTileIds: (number | string)[] = []
  const errors: string[] = []

  for (const c of accepted) {
    try {
      // Taxonomías
      const colorDoc = c.dominantColor
        ? await findOrCreateByName(payload, 'colors', c.dominantColor, {
            hex: null,
          })
        : null
      const finishDoc = c.finishes?.[0]
        ? await findOrCreateByName(payload, 'finishes', c.finishes[0])
        : null
      const formatDoc = c.formats?.[0]
        ? await findOrCreateByName(payload, 'formats', c.formats[0])
        : null

      const usageDocs = await Promise.all(
        (c.usage || []).map((u) => findOrCreateByName(payload, 'usages', u)),
      )
      const roomDocs = await Promise.all(
        (c.rooms || []).map((r) => findOrCreateByName(payload, 'rooms', r)),
      )

      // Colección
      let collectionId: number | string | null = null
      if (c.collection) {
        const col = await findOrCreateByName(payload, 'collections', c.collection, {
          brand: brandId,
        })
        collectionId = col?.id ?? null
      }

      // Imágenes:
      //   mainImage  = foto de ambiente (compartida por todas las variantes de la página)
      //   textureImage = recorte de la textura específica de esta variante
      // Si alguna falta, usamos la página entera como fallback razonable.
      const ambientId = c.ambientMediaId ?? c.pageMediaId ?? null
      const textureId = c.textureMediaId ?? c.pageMediaId ?? null

      if (!ambientId && !textureId) {
        errors.push(`Sin ninguna imagen: ${c.variantName} — se omite.`)
        continue
      }

      const mainImageId = ambientId ?? textureId
      const textureImageId = textureId ?? mainImageId

      const baseSlug = slugify(c.variantName)
      // Garantizar unicidad de slug
      let slug = baseSlug
      let i = 2
      while (true) {
        const dup = await payload.find({
          collection: 'tiles',
          where: { slug: { equals: slug } },
          limit: 1,
        })
        if (dup.docs.length === 0) break
        slug = `${baseSlug}-${i++}`
      }

      const tile = await payload.create({
        collection: 'tiles',
        data: {
          name: c.variantName,
          slug,
          sku: c.sku,
          description: c.description,
          mainImage: mainImageId,
          textureImage: textureImageId,
          brand: brandId,
          collection: collectionId,
          colors: colorDoc ? [colorDoc.id] : [],
          finish: finishDoc?.id,
          format: formatDoc?.id,
          usages: usageDocs.filter(Boolean).map((d: any) => d.id),
          rooms: roomDocs.filter(Boolean).map((d: any) => d.id),
          published: true,
          featured: false,
          aiReady: false,
        } as any,
      })

      createdTileIds.push(tile.id)
    } catch (err) {
      errors.push(`Error en "${c.variantName}": ${(err as Error).message}`)
    }
  }

  await payload.update({
    collection: 'pdf-imports',
    id,
    data: {
      status: 'completed',
      currentStep: `Publicados ${createdTileIds.length} azulejos. ${errors.length} avisos.`,
      createdTiles: createdTileIds,
      completedAt: new Date().toISOString(),
      errorMessage: errors.length > 0 ? errors.join('\n') : undefined,
    } as any,
  })

  return NextResponse.json({
    ok: true,
    createdCount: createdTileIds.length,
    createdTileIds,
    errors,
  })
}
