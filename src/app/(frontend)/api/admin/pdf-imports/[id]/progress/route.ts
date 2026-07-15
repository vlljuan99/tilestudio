import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'

/**
 * Progreso ligero de una importación, pensado para el polling del asistente.
 *
 * Devuelve solo lo necesario para pintar la vista de progreso (estado, %,
 * paso actual, coste y las últimas variantes encontradas con su miniatura),
 * evitando arrastrar el array completo de extractedItems (que en catálogos
 * grandes puede superar el megabyte) en cada tick de 2s.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  let doc: any
  try {
    doc = await payload.findByID({ collection: 'pdf-imports', id, depth: 0 })
  } catch {
    return NextResponse.json({ error: 'Import no encontrado.' }, { status: 404 })
  }

  const items: any[] = Array.isArray(doc.extractedItems) ? doc.extractedItems : []
  const recent = items
    .slice(-12)
    .reverse()
    .map((c) => ({
      id: c.id,
      variantName: c.variantName,
      seriesName: c.seriesName || null,
      page: c.page,
      textureImageUrl: c.textureImageUrl || null,
      ambientImageUrl: c.ambientImageUrl || null,
      reviewStatus: c.reviewStatus,
    }))

  const seriesCount = new Set(
    items.map((c) => (c.seriesName || '').toLowerCase()).filter(Boolean),
  ).size

  const usage: any[] = Array.isArray(doc.aiUsage) ? doc.aiUsage : []
  const costUsd = usage.reduce((s, u) => s + (u?.estimatedCostUsd || 0), 0)

  return NextResponse.json({
    id: doc.id,
    displayName: doc.displayName,
    status: doc.status,
    progressPercent: doc.progressPercent ?? 0,
    processedPages: doc.processedPages ?? 0,
    totalPages: doc.totalPages ?? null,
    pageRangeFrom: doc.pageRangeFrom ?? 1,
    pageRangeTo: doc.pageRangeTo ?? null,
    pdfTotalPages: doc.pdfTotalPages ?? null,
    lastProcessedPage: doc.lastProcessedPage ?? null,
    candidatesCount: doc.candidatesCount ?? items.length,
    seriesCount,
    currentStep: doc.currentStep || null,
    errorMessage: doc.errorMessage || null,
    startedAt: doc.startedAt || null,
    completedAt: doc.completedAt || null,
    costUsd,
    recent,
  })
}
