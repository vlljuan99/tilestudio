/**
 * Worker que procesa un PdfImport.
 *
 * Orquesta el núcleo de extracción (compartido con el banco de pruebas local):
 *   1. Carga el PDF desde Media e itera páginas (rango + cap configurables).
 *   2. Por cada página: analyzePage() detecta variantes (con su textura), entornos
 *      y datos de serie; subimos las imágenes a Media y las acumulamos en un
 *      CandidateStore que fusiona duplicados, enlaza multi-entornos y propaga
 *      datos de serie.
 *   3. Persistimos candidatos y progreso en DB en cada iteración (lo ve el admin).
 *   4. Marca status = review_ready al terminar.
 *
 * "Fire and forget" desde un Route Handler de Next: el handler dispara el worker
 * y devuelve; el front-end pollea el DB para el progreso.
 *
 * Proveedor de visión: getVisionExtractor() — Gemini 2.5 Flash por defecto,
 * fallback a gpt-4o-mini. Forzar con AI_VISION_PROVIDER=gemini|openai.
 */
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'
import { loadPdf, iteratePages, getTotalPages } from './extractor'
import { analyzePage } from './page-analysis'
import { CandidateStore, type StoreFn, type StoredCandidate } from './candidate-store'
import { getVisionExtractor, type UsageStats } from '../ai/vision'

/** "1.234k tokens ≈ $0.42" — resumen del consumo de visión para el admin. */
function formatUsage(usage: UsageStats[]): string {
  if (usage.length === 0) return ''
  const totalToks = usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0)
  const totalCost = usage.reduce((s, u) => s + u.estimatedCostUsd, 0)
  return `IA: ${Math.round(totalToks / 1000)}k tokens ≈ ${totalCost.toFixed(2)} $`
}

/**
 * Candidato tal y como se persiste en `pdf-imports.extractedItems` (lo consumen
 * la UI de revisión y el endpoint de publicación). Mantiene los nombres de campo
 * históricos (texture/ambientImageUrl, …) y añade los entornos en plural.
 */
export type Candidate = {
  id: string
  page: number
  pages?: number[]
  brand?: string | null
  collection?: string | null
  seriesName?: string | null
  variantName: string
  sku?: string | null
  colorCode?: string | null
  formats?: string[]
  finishes?: string[]
  specialPieces?: string[]
  dominantColor?: string | null
  description?: string | null
  usage?: string[]
  rooms?: string[]
  textureImageUrl?: string
  textureMediaId?: number | string
  textureSource?: 'embedded' | 'crop'
  textureArea?: number
  /** Primer entorno (compatibilidad con la UI antigua). */
  ambientImageUrl?: string
  ambientMediaId?: number | string
  /** Todos los entornos donde aparece la variante. */
  ambientImageUrls?: string[]
  ambientMediaIds?: (number | string)[]
  pageImageUrl?: string
  pageMediaId?: number | string
  reviewStatus: 'pending' | 'accepted' | 'rejected'
  /** Tile ya creado a partir de este candidato — evita duplicados al republicar. */
  publishedTileId?: number | string | null
}

/** "123" → 123 (id numérico de Media); deja strings como están. */
function refToId(ref?: string): number | string | undefined {
  if (ref == null || ref === '') return undefined
  return /^\d+$/.test(ref) ? Number(ref) : ref
}

/** Mapea el candidato del store (refs opacas) al shape persistido (ids de Media). */
function toPersisted(c: StoredCandidate): Candidate {
  return {
    id: c.id,
    page: c.page,
    pages: c.pages,
    brand: c.brand,
    collection: c.collection,
    seriesName: c.seriesName,
    variantName: c.variantName,
    sku: c.sku,
    colorCode: c.colorCode,
    formats: c.formats,
    finishes: c.finishes,
    specialPieces: c.specialPieces,
    dominantColor: c.dominantColor,
    description: c.description,
    usage: c.usage,
    rooms: c.rooms,
    textureImageUrl: c.textureUrl,
    textureMediaId: refToId(c.textureRef),
    textureSource: c.textureSource,
    textureArea: c.textureArea,
    ambientImageUrl: c.ambientUrls.find(Boolean),
    ambientMediaId: refToId(c.ambientRefs[0]),
    ambientImageUrls: c.ambientUrls.filter(Boolean),
    ambientMediaIds: c.ambientRefs.map(refToId).filter((x): x is number | string => x != null),
    pageImageUrl: c.pageUrl,
    pageMediaId: refToId(c.pageRef),
    reviewStatus: c.reviewStatus,
    publishedTileId: c.publishedTileId,
  }
}

/**
 * Conserva las decisiones de revisión tomadas MIENTRAS el worker corre. El admin
 * puede aceptar/rechazar candidatos en /review antes de que la extracción termine,
 * y como el worker reescribe extractedItems entero en cada página, sin este merge
 * esas decisiones se perderían en la siguiente escritura.
 */
export async function mergeReviewStatuses(
  payload: Payload,
  importId: number | string,
  candidates: Candidate[],
): Promise<void> {
  try {
    const current = await payload.findByID({ collection: 'pdf-imports', id: importId, depth: 0 })
    const stored: Candidate[] = ((current as any).extractedItems || []) as Candidate[]
    const byId = new Map(stored.map((c) => [c.id, c]))
    for (const cand of candidates) {
      const storedCand = byId.get(cand.id)
      if (!storedCand) continue
      if (storedCand.reviewStatus && storedCand.reviewStatus !== 'pending') {
        cand.reviewStatus = storedCand.reviewStatus
      }
      if (storedCand.publishedTileId != null) cand.publishedTileId = storedCand.publishedTileId
    }
  } catch {
    // Si falla la lectura seguimos sin merge: peor perder una decisión que parar el worker
  }
}

async function uploadMedia(
  payload: any,
  buffer: Buffer,
  name: string,
  alt: string,
): Promise<{ id: number | string; url: string } | undefined> {
  try {
    const media = (await payload.create({
      collection: 'media',
      data: { alt } as any,
      file: { name, data: buffer, mimetype: 'image/jpeg', size: buffer.length },
    })) as any
    return { id: media.id, url: media.url }
  } catch (err) {
    console.warn(`uploadMedia error (${name}):`, (err as Error).message)
    return undefined
  }
}

async function fetchPdfBuffer(payload: any, mediaId: number | string): Promise<Buffer> {
  const media = await payload.findByID({ collection: 'media', id: mediaId })
  if (!media?.filename) throw new Error('PDF Media no tiene filename')
  const { readFile } = await import('fs/promises')
  const { join } = await import('path')
  return readFile(join(process.cwd(), 'media', media.filename))
}

function safeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

export async function runPdfImport(importId: number | string) {
  const payload = await getPayload({ config })

  const importDoc = (await payload.findByID({ collection: 'pdf-imports', id: importId })) as any
  if (!importDoc) {
    console.error('PdfImport not found:', importId)
    return
  }

  let extractor: ReturnType<typeof getVisionExtractor>
  try {
    extractor = getVisionExtractor()
    console.log(`[PdfImport] Vision extractor: ${extractor.id}`)
  } catch (err) {
    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: { status: 'failed', errorMessage: (err as Error).message } as any,
    })
    return
  }

  const fileId =
    typeof importDoc.originalFile === 'object' ? importDoc.originalFile.id : importDoc.originalFile

  try {
    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: {
        status: 'processing',
        startedAt: new Date().toISOString(),
        currentStep: 'Descargando PDF…',
        processedPages: 0,
        progressPercent: 0,
      } as any,
    })

    const pdfBuffer = await fetchPdfBuffer(payload, fileId)

    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: { currentStep: 'Analizando estructura del PDF…' } as any,
    })

    const totalPages = await getTotalPages(pdfBuffer)
    const fromPage = Math.max(1, importDoc.pageRangeFrom || 1)
    const toPage = Math.min(totalPages, importDoc.pageRangeTo || totalPages)
    const maxPages = importDoc.maxPages || 30
    const effectiveTo = Math.min(toPage, fromPage + maxPages - 1)
    const pagesToProcess = effectiveTo - fromPage + 1

    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: {
        // Guardamos las páginas A PROCESAR (no las del PDF entero): es el
        // denominador del progreso que muestra el admin.
        totalPages: pagesToProcess,
        currentStep: `Procesando páginas ${fromPage}–${effectiveTo} (${pagesToProcess} de ${totalPages} del PDF)…`,
      } as any,
    })

    const doc = await loadPdf(pdfBuffer)

    // StoreFn: sube cada textura/entorno a Media y devuelve su id como ref opaca.
    const storeFn: StoreFn = async (jpeg, kind, meta) => {
      const tag = meta.variantName ? safeName(meta.variantName) : kind
      const m = await uploadMedia(
        payload,
        jpeg,
        `pdf-import-${importId}-p${meta.page}-${kind}-${tag}-${Math.random().toString(36).slice(2, 7)}.jpg`,
        `${kind === 'texture' ? 'Textura' : 'Ambiente'} ${meta.variantName || ''} p.${meta.page}`.trim(),
      )
      if (!m) return undefined
      return { ref: String(m.id), url: m.url }
    }

    const store = new CandidateStore(storeFn)
    let processed = 0

    for await (const page of iteratePages(doc, fromPage, effectiveTo)) {
      processed++
      const percent = Math.round((processed / pagesToProcess) * 100)

      await payload.update({
        collection: 'pdf-imports',
        id: importId,
        data: {
          processedPages: processed,
          progressPercent: percent,
          currentStep: `Página ${page.pageNumber}: subiendo render y llamando a la IA…`,
        } as any,
      })

      // Render completo como fallback de revisión.
      const pageMedia = await uploadMedia(
        payload,
        page.renderJpeg,
        `pdf-import-${importId}-p${page.pageNumber}.jpg`,
        `Página ${page.pageNumber} del PDF`,
      )
      const pageImage = pageMedia ? { ref: String(pageMedia.id), url: pageMedia.url } : undefined

      try {
        const analysis = await analyzePage(doc, page, extractor)
        const { added, merged } = await store.addPage(analysis, pageImage)

        const persisted = store.candidates.map(toPersisted)
        await mergeReviewStatuses(payload, importId, persisted)
        await payload.update({
          collection: 'pdf-imports',
          id: importId,
          data: {
            extractedItems: persisted,
            candidatesCount: persisted.length,
            aiUsage: extractor.getUsage(),
            currentStep: `Página ${page.pageNumber}: ${added} candidatos nuevos${merged > 0 ? `, ${merged} fusionados` : ''}`,
          } as any,
        })
      } catch (err) {
        console.warn(`Análisis falló en p.${page.pageNumber}:`, (err as Error).message)
        await payload.update({
          collection: 'pdf-imports',
          id: importId,
          data: { currentStep: `Página ${page.pageNumber}: error en IA, se omite` } as any,
        })
      }
    }

    await doc.destroy()

    const usage = extractor.getUsage()
    const usageSummary = formatUsage(usage)
    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: {
        status: 'review_ready',
        completedAt: new Date().toISOString(),
        progressPercent: 100,
        aiUsage: usage,
        currentStep: `Listo. ${store.candidates.length} candidatos a revisar.${usageSummary ? ` ${usageSummary}` : ''}`,
      } as any,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido en el worker.'
    console.error('PdfImport falló:', err)
    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: {
        status: 'failed',
        errorMessage: msg,
        completedAt: new Date().toISOString(),
      } as any,
    })
  }
}
