import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { readFile } from 'fs/promises'
import { join } from 'path'

import { getTotalPages } from '@/lib/pdf/extractor'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Crea un PdfImport desde el asistente de importación.
 *
 * El PDF ya está subido a Media (el wizard lo sube antes vía POST /api/media,
 * que da progreso de subida); aquí solo se cuenta el total de páginas, se
 * resuelve el alcance (todo el catálogo o un rango) y se crea el documento
 * listo para arrancar.
 *
 * Body JSON: { mediaId, brandId?, scope: 'all' | 'range', fromPage?, toPage? }
 */
export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido.' }, { status: 400 })
  }

  const { mediaId, brandId, scope } = body || {}
  if (!mediaId) {
    return NextResponse.json({ error: 'Falta mediaId.' }, { status: 400 })
  }

  let media: any
  try {
    media = await payload.findByID({ collection: 'media', id: mediaId })
  } catch {
    return NextResponse.json({ error: 'El PDF subido no se encuentra en Media.' }, { status: 404 })
  }
  if (!media?.filename || !/\.pdf$/i.test(media.filename)) {
    return NextResponse.json({ error: 'El fichero subido no es un PDF.' }, { status: 400 })
  }

  let totalPages: number
  try {
    const buffer = await readFile(join(process.cwd(), 'media', media.filename))
    totalPages = await getTotalPages(buffer)
  } catch (err) {
    return NextResponse.json(
      { error: `No se pudo leer el PDF: ${(err as Error).message}` },
      { status: 500 },
    )
  }

  const fromPage = scope === 'range' ? Math.max(1, Number(body.fromPage) || 1) : 1
  const toPage =
    scope === 'range'
      ? Math.min(totalPages, Number(body.toPage) || totalPages)
      : totalPages
  if (toPage < fromPage) {
    return NextResponse.json({ error: 'Rango de páginas inválido.' }, { status: 400 })
  }

  const importDoc = await payload.create({
    collection: 'pdf-imports',
    data: {
      originalFile: media.id,
      brand: brandId || undefined,
      pageRangeFrom: fromPage,
      pageRangeTo: toPage,
      // El wizard fija el alcance explícitamente: el tope de seguridad cubre
      // exactamente el rango elegido (no queremos el default de 30 recortándolo).
      maxPages: toPage - fromPage + 1,
      pdfTotalPages: totalPages,
      status: 'queued',
    } as any,
  })

  return NextResponse.json({
    ok: true,
    id: importDoc.id,
    totalPages,
    fromPage,
    toPage,
    pagesToProcess: toPage - fromPage + 1,
  })
}
