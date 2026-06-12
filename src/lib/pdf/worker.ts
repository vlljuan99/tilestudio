/**
 * Worker que procesa un PdfImport.
 *
 * Pasos:
 *   1. Carga el PDF desde Media.
 *   2. Itera páginas (con rango y cap configurables).
 *   3. Por cada página: renderiza + llama a gpt-4o-mini con visión.
 *   4. Persiste candidatos y progreso en DB en cada iteración (lo verá el admin).
 *   5. Marca status = review_ready al terminar.
 *
 * Diseñado como "fire and forget" desde un Route Handler de Next: el handler
 * dispara el worker y devuelve inmediatamente. El front-end pollea el DB para
 * ver el progreso.
 *
 * Proveedor de visión: se selecciona automáticamente via getVisionExtractor().
 * Por defecto Gemini 2.5 Flash (GOOGLE_API_KEY). Fallback a gpt-4o-mini (OPENAI_API_KEY).
 * Forzar con AI_VISION_PROVIDER=gemini|openai.
 */
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import config from '@payload-config'
import { loadPdf, iteratePages, getTotalPages, extractEmbeddedImages, type EmbeddedImage } from './extractor'
import { getVisionExtractor, type ExtractionResult, type UsageStats } from '../ai/vision'

/** "1.234k tokens ≈ $0.42" — resumen del consumo de visión para el admin. */
function formatUsage(usage: UsageStats[]): string {
  if (usage.length === 0) return ''
  const totalToks = usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0)
  const totalCost = usage.reduce((s, u) => s + u.estimatedCostUsd, 0)
  return `IA: ${Math.round(totalToks / 1000)}k tokens ≈ ${totalCost.toFixed(2)} $`
}

// =============================================================================
// Matching de imágenes embebidas a candidatos
// =============================================================================

/**
 * Asigna cada candidato a una imagen embebida distinta minimizando la distancia
 * acumulada entre centros. Algoritmo greedy: ordena por distancia y empareja
 * en orden, evitando reusos.
 *
 * Devuelve un Map(candidateIdx → EmbeddedImage). Los que no se pudieron
 * matchear no aparecen en el Map (devolverán undefined).
 */
function matchEmbeddedToCandidates(
  embedded: EmbeddedImage[],
  candidateBboxes: Array<[number, number, number, number] | null | undefined>,
): Map<number, EmbeddedImage> {
  type Pair = { ci: number; ei: number; dist: number }
  const pairs: Pair[] = []
  for (let ci = 0; ci < candidateBboxes.length; ci++) {
    const bb = candidateBboxes[ci]
    if (!bb) continue
    const cx = (bb[0] + bb[2]) / 2
    const cy = (bb[1] + bb[3]) / 2
    for (let ei = 0; ei < embedded.length; ei++) {
      const img = embedded[ei]
      const dx = cx - img.cx
      const dy = cy - img.cy
      pairs.push({ ci, ei, dist: Math.hypot(dx, dy) })
    }
  }
  pairs.sort((a, b) => a.dist - b.dist)
  const usedC = new Set<number>()
  const usedE = new Set<number>()
  const matches = new Map<number, EmbeddedImage>()
  // 1ª pasada: emparejamos los pares más cercanos con threshold razonable.
  for (const p of pairs) {
    if (usedC.has(p.ci) || usedE.has(p.ei)) continue
    if (p.dist > 0.5) continue
    usedC.add(p.ci)
    usedE.add(p.ei)
    matches.set(p.ci, embedded[p.ei])
  }
  // 2ª pasada: los candidatos sueltos los asignamos a los swatches sueltos
  // que queden, en orden de proximidad. Sin threshold — preferimos un swatch
  // sub-óptimo a un crop pixelado del render.
  for (const p of pairs) {
    if (usedC.has(p.ci) || usedE.has(p.ei)) continue
    usedC.add(p.ci)
    usedE.add(p.ei)
    matches.set(p.ci, embedded[p.ei])
  }
  return matches
}

/**
 * Encuentra la imagen embebida que probablemente es el ambient: la más grande
 * en el rango de área aceptable y con aspect ratio fotográfico (1:1 a 2:1).
 *
 * Filtra primero las imágenes ya usadas como swatches.
 */
function findAmbientImage(
  embedded: EmbeddedImage[],
  alreadyUsed: Set<EmbeddedImage>,
  ambientBboxHint?: [number, number, number, number] | null,
): EmbeddedImage | null {
  const candidates = embedded.filter((img) => !alreadyUsed.has(img))
  if (candidates.length === 0) return null

  // Si tenemos hint del LLM, preferimos la más cercana al centro de ese bbox
  if (ambientBboxHint) {
    const cx = (ambientBboxHint[0] + ambientBboxHint[2]) / 2
    const cy = (ambientBboxHint[1] + ambientBboxHint[3]) / 2
    let best: EmbeddedImage | null = null
    let bestScore = -Infinity
    for (const img of candidates) {
      const dist = Math.hypot(img.cx - cx, img.cy - cy)
      // Score: penaliza distancia, premia área. Los ambientes son típicamente
      // las imágenes más grandes del spread.
      const area = img.width * img.height
      const score = area / 1_000_000 - dist * 3
      if (score > bestScore) {
        bestScore = score
        best = img
      }
    }
    return best
  }

  // Sin hint: la más grande con aspect ratio fotográfico (0.5–2.5)
  let best: EmbeddedImage | null = null
  let bestArea = 0
  for (const img of candidates) {
    if (img.aspect < 0.5 || img.aspect > 2.5) continue
    const area = img.width * img.height
    if (area > bestArea) {
      bestArea = area
      best = img
    }
  }
  return best
}

export type Candidate = {
  id: string
  /** página del PDF donde aparece (1-based; la primera en que se vio) */
  page: number
  /** todas las páginas donde apareció esta variante (tras fusionar duplicados) */
  pages?: number[]
  brand?: string | null
  collection?: string | null
  seriesName?: string | null
  variantName: string
  sku?: string | null
  /** Código de color impreso (RAL / NCS / Pantone). */
  colorCode?: string | null
  formats?: string[]
  finishes?: string[]
  dominantColor?: string | null
  description?: string | null
  usage?: string[]
  rooms?: string[]
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la textura de esta variante en la página. */
  textureBbox?: [number, number, number, number] | null
  /** Crop de la textura. */
  textureImageUrl?: string
  textureMediaId?: number | string
  /** Procedencia de la textura: embebida original del PDF o crop del render. */
  textureSource?: 'embedded' | 'crop'
  /** Área en píxeles de la textura subida (para elegir la mejor al fusionar). */
  textureArea?: number
  /** Crop de la foto ambiente compartida con todas las variantes de la misma página. */
  ambientImageUrl?: string
  ambientMediaId?: number | string
  /** Página completa (fallback para revisión). */
  pageImageUrl?: string
  pageMediaId?: number | string
  reviewStatus: 'pending' | 'accepted' | 'rejected'
  /** Tile ya creado a partir de este candidato — evita duplicados si se publica varias veces. */
  publishedTileId?: number | string | null
}

type BBox = [number, number, number, number]

/**
 * Conserva las decisiones de revisión tomadas MIENTRAS el worker corre.
 * El admin puede aceptar/rechazar candidatos en /review antes de que la
 * extracción termine, y como el worker escribe extractedItems entero en cada
 * página, sin este merge esas decisiones se perderían en la siguiente escritura.
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

function makeCandidateId(page: number, idx: number): string {
  return `p${page}_${idx}_${Math.random().toString(36).slice(2, 8)}`
}

// =============================================================================
// Fusión de candidatos duplicados entre páginas
// =============================================================================
//
// La misma variante suele aparecer en varias páginas del catálogo: paleta de
// colores, textura a página completa y ficha técnica. Sin fusión, el admin ve
// 3 candidatos "Cōre White" con datos parciales cada uno. Fusionamos por nombre
// normalizado y nos quedamos con lo mejor de cada aparición.

/** Clave de fusión: nombre sin diacríticos (ō→o), minúsculas, espacios colapsados. */
function candidateKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "60X120" / "60 × 120" → "60x120" para deduplicar formatos. */
function normalizeFormat(f: string): string {
  return f.toLowerCase().replace(/\s+/g, '').replace(/×/g, 'x')
}

/** "cōre ivory" / "CŌRE IVORY" → "Cōre Ivory" — los catálogos rotulan los
 * nombres en minúsculas o versales según la página; unificamos para que el
 * nombre del producto quede presentable. */
function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

function unionList(
  a: string[] | undefined,
  b: string[] | undefined,
  normalize: (s: string) => string = (s) => s.toLowerCase().trim(),
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of [...(a || []), ...(b || [])]) {
    if (!item) continue
    const k = normalize(item)
    if (seen.has(k) || !k) continue
    seen.add(k)
    out.push(item)
  }
  return out
}

/**
 * Fusiona `incoming` dentro de `existing` (misma variante vista en otra página).
 * Mantiene la mejor textura (embebida > crop; a igualdad, mayor área) y rellena
 * los huecos de datos sin pisar lo ya extraído.
 */
function mergeInto(existing: Candidate, incoming: Candidate): void {
  existing.pages = Array.from(new Set([...(existing.pages || [existing.page]), incoming.page])).sort(
    (a, b) => a - b,
  )
  existing.formats = unionList(existing.formats, incoming.formats, normalizeFormat)
  existing.finishes = unionList(existing.finishes, incoming.finishes)
  existing.usage = unionList(existing.usage, incoming.usage)
  existing.rooms = unionList(existing.rooms, incoming.rooms)
  if (!existing.sku && incoming.sku) existing.sku = incoming.sku
  if (!existing.colorCode && incoming.colorCode) existing.colorCode = incoming.colorCode
  if (!existing.dominantColor && incoming.dominantColor) {
    existing.dominantColor = incoming.dominantColor
  }
  if (!existing.seriesName && incoming.seriesName) existing.seriesName = incoming.seriesName
  if (!existing.brand && incoming.brand) existing.brand = incoming.brand
  if (!existing.collection && incoming.collection) existing.collection = incoming.collection
  if ((incoming.description?.length || 0) > (existing.description?.length || 0)) {
    existing.description = incoming.description
  }

  // Textura: embebida gana a crop; dentro del mismo origen, la de mayor área.
  const tierOf = (c: Candidate) => (c.textureSource === 'embedded' ? 1 : 0)
  const incomingBetter =
    incoming.textureMediaId &&
    (!existing.textureMediaId ||
      tierOf(incoming) > tierOf(existing) ||
      (tierOf(incoming) === tierOf(existing) &&
        (incoming.textureArea || 0) > (existing.textureArea || 0)))
  if (incomingBetter) {
    existing.textureMediaId = incoming.textureMediaId
    existing.textureImageUrl = incoming.textureImageUrl
    existing.textureSource = incoming.textureSource
    existing.textureArea = incoming.textureArea
  }

  if (!existing.ambientMediaId && incoming.ambientMediaId) {
    existing.ambientMediaId = incoming.ambientMediaId
    existing.ambientImageUrl = incoming.ambientImageUrl
  }
}

/**
 * Recorta el render JPEG de una página usando una bbox normalizada 0-1.
 * Aplica un pequeño margen para no quedarse pegado al borde.
 * Devuelve null si la bbox es inválida o demasiado pequeña.
 */
async function cropFromPage(
  pageJpeg: Buffer,
  bbox: BBox,
  marginPct = 0.005,
): Promise<Buffer | null> {
  if (!Array.isArray(bbox) || bbox.length !== 4) return null
  let [x1, y1, x2, y2] = bbox
  if ([x1, y1, x2, y2].some((n) => typeof n !== 'number' || isNaN(n))) return null
  if (x2 <= x1 || y2 <= y1) return null

  x1 = Math.max(0, x1 - marginPct)
  y1 = Math.max(0, y1 - marginPct)
  x2 = Math.min(1, x2 + marginPct)
  y2 = Math.min(1, y2 + marginPct)

  const meta = await sharp(pageJpeg).metadata()
  const W = meta.width || 0
  const H = meta.height || 0
  if (!W || !H) return null

  const left = Math.round(x1 * W)
  const top = Math.round(y1 * H)
  const width = Math.round((x2 - x1) * W)
  const height = Math.round((y2 - y1) * H)
  if (width < 32 || height < 32) return null

  // 1) Recortamos por bbox + trim de bordes blancos (texto a fondo blanco no se trim).
  const trimmed = await sharp(pageJpeg)
    .extract({ left, top, width, height })
    .trim({ background: 'white', threshold: 25 })
    .toBuffer()

  // 2) Si el resultado es demasiado alto vs ancho (LLM dió un y2 muy bajo metiendo
  // texto y tablas técnicas), recortamos el sobrante por abajo para que quede ≤ 1.25:1.
  const tMeta = await sharp(trimmed).metadata()
  const tw = tMeta.width || 0
  const th = tMeta.height || 0
  if (!tw || !th) return null
  // Tile catalogs: ambient photos suelen ser landscape o casi cuadradas. Cuando el
  // crop sale más alto que ancho, casi seguro es que el LLM incluyó textos/tablas
  // del pie de página — recortamos al máximo cuadrado.
  const MAX_HEIGHT_RATIO = 1.0
  if (th > tw * MAX_HEIGHT_RATIO) {
    const newHeight = Math.round(tw * MAX_HEIGHT_RATIO)
    return sharp(trimmed)
      .extract({ left: 0, top: 0, width: tw, height: newHeight })
      .jpeg({ quality: 92 })
      .toBuffer()
  }
  return sharp(trimmed).jpeg({ quality: 92 }).toBuffer()
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

export async function runPdfImport(importId: number | string) {
  const payload = await getPayload({ config })

  // Load import doc
  const importDoc = (await payload.findByID({ collection: 'pdf-imports', id: importId })) as any
  if (!importDoc) {
    console.error('PdfImport not found:', importId)
    return
  }

  // Inicializar extractor de visión (Gemini por defecto, fallback OpenAI)
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

  const fileId = typeof importDoc.originalFile === 'object'
    ? importDoc.originalFile.id
    : importDoc.originalFile

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
        // denominador del progreso que muestra el admin — con un rango
        // parcial, "Página 10 de 27 · 67%" no cuadraba.
        totalPages: pagesToProcess,
        currentStep: `Procesando páginas ${fromPage}–${effectiveTo} (${pagesToProcess} de ${totalPages} del PDF)…`,
      } as any,
    })

    const doc = await loadPdf(pdfBuffer)
    const allCandidates: Candidate[] = []
    /** variantName normalizado → candidato ya creado (para fusionar duplicados) */
    const candidateIndex = new Map<string, Candidate>()
    /** ambientes con callouts de producto, a la espera de su variante (puede salir en otra página) */
    const pendingAmbients = new Map<string, { id: number | string; url: string }>()
    let brandDetected: string | null = null
    let collectionDetected: string | null = null
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

      // Subir el render completo como fallback (lo usamos en review si no hay bbox)
      const pageMedia = await uploadMedia(
        payload,
        page.renderJpeg,
        `pdf-import-${importId}-p${page.pageNumber}.jpg`,
        `Página ${page.pageNumber} del PDF`,
      )

      // Pipeline híbrido:
      //  1. Extraer las imágenes embebidas del PDF (calidad print, sin cropping).
      //  2. Separarlas en "ambientes candidatos" (las grandes) y "swatches" (texturas).
      //  3. LLM identifica variantes + bbox aproximada de cada una.
      //  4. Matchear cada candidato a un SWATCH cercano en posición (no a un ambient).
      //  5. El ambient es la imagen más grande (con preferencia por el bbox del LLM).
      try {
        // 1. Imágenes embebidas. Umbral bajo (120px): los swatches de las
        //    páginas de paleta rondan los 170×340; los iconos/logos (~28px)
        //    siguen quedando fuera.
        const allEmbedded = await extractEmbeddedImages(doc, page.pageNumber, {
          minWidth: 120,
          minHeight: 120,
        })

        // 2. Separar ambient(s) de swatches: las imágenes con área notablemente
        //    mayor que la mediana son fotos de ambiente; el resto son swatches.
        let swatches: EmbeddedImage[] = allEmbedded
        let ambientCandidates: EmbeddedImage[] = []
        if (allEmbedded.length >= 2) {
          const areas = allEmbedded.map((img) => img.width * img.height)
          const sorted = [...areas].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          // Una imagen es "ambient candidate" si su área es 2.5x mayor que la mediana
          ambientCandidates = allEmbedded.filter(
            (img) => img.width * img.height >= median * 2.5,
          )
          swatches = allEmbedded.filter((img) => !ambientCandidates.includes(img))
        }

        // 3. LLM
        const lowResForLlm = await sharp(page.renderJpeg)
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer()
        const base64 = lowResForLlm.toString('base64')
        const result = await extractor.extract(base64, page.text)

        if (!brandDetected && result.brandDetected) brandDetected = result.brandDetected
        if (!collectionDetected && result.collectionDetected) {
          collectionDetected = result.collectionDetected
        }

        // Tipos de página que por definición no presentan variantes. Si el LLM
        // devuelve products en una de ellas (le pasa con los peldaños/piezas
        // especiales pese al prompt), nos fiamos del pageType y los ignoramos.
        const NO_PRODUCT_PAGE_TYPES = new Set([
          'cover',
          'index',
          'graphic-variation',
          'special-pieces',
          'other',
        ])
        const pageHasProducts = !NO_PRODUCT_PAGE_TYPES.has(result.pageType || '')
        if (!pageHasProducts && (result.products?.length || 0) > 0) {
          console.warn(
            `[PdfImport] p.${page.pageNumber}: ${result.products!.length} products ignorados (pageType=${result.pageType})`,
          )
        }
        const products = pageHasProducts
          ? (result.products || []).filter((p) => p.variantName?.trim())
          : []
        const ambientProductNames = (result.ambientProducts || []).filter(Boolean)
        const candidateBboxes = products.map((p) => p.textureBbox)

        // 4. Matching: solo entre swatches y candidatos (no ambients)
        const candidateMatches = matchEmbeddedToCandidates(swatches, candidateBboxes)
        const usedEmbedded = new Set<EmbeddedImage>()
        for (const img of candidateMatches.values()) usedEmbedded.add(img)

        // 5. Ambient: solo si hay con quién enlazarlo (productos en esta página
        //    o callouts que nombran variantes de otras). El LLM solo da
        //    ambientBbox para fotos de estancia real, no texturas.
        let sharedAmbient: { id: number | string; url: string } | undefined
        if (
          result.ambientBbox &&
          (products.length > 0 || ambientProductNames.length > 0)
        ) {
          const ambientPool = ambientCandidates.length > 0 ? ambientCandidates : allEmbedded
          const ambientImg = findAmbientImage(ambientPool, usedEmbedded, result.ambientBbox)
          if (ambientImg) {
            sharedAmbient = await uploadMedia(
              payload,
              ambientImg.jpeg,
              `pdf-import-${importId}-p${page.pageNumber}-ambient.jpg`,
              `Ambiente p.${page.pageNumber}`,
            )
          } else {
            // Fallback: si no encontramos embedded apto, recortamos del render
            const ambientCrop = await cropFromPage(page.renderJpeg, result.ambientBbox)
            if (ambientCrop) {
              sharedAmbient = await uploadMedia(
                payload,
                ambientCrop,
                `pdf-import-${importId}-p${page.pageNumber}-ambient.jpg`,
                `Ambiente p.${page.pageNumber}`,
              )
            }
          }
        }

        // Registrar el ambiente para las variantes que nombran sus callouts
        // (p.ej. "CŌRE MIX TAUPE" en la foto de la paleta Cōre) — la variante
        // puede aparecer en una página posterior.
        if (sharedAmbient) {
          for (const name of ambientProductNames) {
            const key = candidateKey(name)
            if (key && !pendingAmbients.has(key)) pendingAmbients.set(key, sharedAmbient)
          }
        }

        // 6. Construir candidatos con la imagen embebida matcheada (o fallback)
        const newCandidates: Candidate[] = []
        for (let idx = 0; idx < products.length; idx++) {
          const p = products[idx]
          const matchedImg = candidateMatches.get(idx)
          const safeName = p.variantName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')

          let texture: { id: number | string; url: string } | undefined
          let textureSource: Candidate['textureSource']
          let textureArea = 0
          if (matchedImg) {
            texture = await uploadMedia(
              payload,
              matchedImg.jpeg,
              `pdf-import-${importId}-p${page.pageNumber}-${safeName}.jpg`,
              `Textura ${p.variantName} (${matchedImg.width}×${matchedImg.height})`,
            )
            textureSource = 'embedded'
            textureArea = matchedImg.width * matchedImg.height
          } else if (p.textureBbox) {
            // Fallback al crop del render si el matching falló
            const tCrop = await cropFromPage(page.renderJpeg, p.textureBbox)
            if (tCrop) {
              texture = await uploadMedia(
                payload,
                tCrop,
                `pdf-import-${importId}-p${page.pageNumber}-${safeName}.jpg`,
                `Textura ${p.variantName} (crop)`,
              )
              textureSource = 'crop'
              const tMeta = await sharp(tCrop).metadata()
              textureArea = (tMeta.width || 0) * (tMeta.height || 0)
            }
          }

          newCandidates.push({
            id: makeCandidateId(page.pageNumber, idx),
            page: page.pageNumber,
            pages: [page.pageNumber],
            brand: result.brandDetected ?? brandDetected,
            collection: result.collectionDetected ?? collectionDetected,
            pageImageUrl: pageMedia?.url,
            pageMediaId: pageMedia?.id,
            ambientImageUrl: sharedAmbient?.url,
            ambientMediaId: sharedAmbient?.id,
            textureImageUrl: texture?.url,
            textureMediaId: texture?.id,
            textureSource,
            textureArea,
            reviewStatus: 'pending',
            ...p,
            variantName: titleCase(p.variantName),
            seriesName: p.seriesName ? titleCase(p.seriesName) : p.seriesName,
          })
        }

        // 7. Fusionar con lo ya extraído: la misma variante puede aparecer en
        //    la paleta, en una textura a página completa y en la ficha técnica.
        let addedCount = 0
        let mergedCount = 0
        for (const cand of newCandidates) {
          const key = candidateKey(cand.variantName)
          const existing = candidateIndex.get(key)
          if (existing) {
            mergeInto(existing, cand)
            mergedCount++
          } else {
            candidateIndex.set(key, cand)
            allCandidates.push(cand)
            addedCount++
          }
        }

        // 8. Rellenar ambientes pendientes (callouts que nombraban variantes
        //    extraídas antes o ahora).
        for (const cand of allCandidates) {
          if (cand.ambientMediaId) continue
          const pending = pendingAmbients.get(candidateKey(cand.variantName))
          if (pending) {
            cand.ambientMediaId = pending.id
            cand.ambientImageUrl = pending.url
          }
        }

        await mergeReviewStatuses(payload, importId, allCandidates)
        await payload.update({
          collection: 'pdf-imports',
          id: importId,
          data: {
            extractedItems: allCandidates,
            candidatesCount: allCandidates.length,
            aiUsage: extractor.getUsage(),
            currentStep: `Página ${page.pageNumber}: ${addedCount} candidatos nuevos${mergedCount > 0 ? `, ${mergedCount} fusionados` : ''}`,
          } as any,
        })
      } catch (err) {
        console.warn(`LLM falló en p.${page.pageNumber}:`, (err as Error).message)
        await payload.update({
          collection: 'pdf-imports',
          id: importId,
          data: {
            currentStep: `Página ${page.pageNumber}: error en IA, se omite`,
          } as any,
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
        currentStep: `Listo. ${allCandidates.length} candidatos a revisar.${usageSummary ? ` ${usageSummary}` : ''}`,
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
