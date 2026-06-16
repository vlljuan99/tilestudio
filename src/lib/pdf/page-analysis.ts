/**
 * Análisis de UNA página de catálogo: dado el documento pdfjs, el render de la
 * página y un extractor de visión, devuelve los azulejos detectados con su
 * textura recortada (buffer JPEG), los entornos (fotos de estancia) con sus
 * callouts, y los datos comunes de la serie.
 *
 * Es PURO respecto a Payload: trabaja con buffers, no sube nada. Lo usan tanto
 * el worker de la web (que sube los buffers a Media) como el harness local (que
 * los vuelca a disco para inspección visual). Así la lógica de extracción —
 * matching de swatches, selección de entornos, recortes — es ÚNICA y lo que se
 * valida en local es exactamente lo que corre en producción.
 */
import sharp from 'sharp'
import { extractEmbeddedImages, type EmbeddedImage, type PageData } from './extractor'
import type {
  AmbientRegion,
  ExtractionResult,
  LLMProduct,
  PageType,
  SeriesInfo,
  VisionExtractor,
} from '../ai/vision'

type BBox = [number, number, number, number]

export type AnalyzedTexture = {
  jpeg: Buffer
  /** Procedencia: imagen embebida original del PDF (mejor) o recorte del render. */
  source: 'embedded' | 'crop'
  width: number
  height: number
  area: number
}

export type AnalyzedProduct = {
  product: LLMProduct
  texture: AnalyzedTexture | null
}

export type AnalyzedAmbient = {
  jpeg: Buffer
  source: 'embedded' | 'crop'
  width: number
  height: number
  /** Nombres de producto citados en callouts (sin formato). */
  productNames: string[]
  /** Superficies aplicadas: 'floor' | 'wall' | 'other'. */
  surfaces: string[]
}

export type PageAnalysis = {
  pageNumber: number
  pageType: PageType | null
  brandDetected: string | null
  collectionDetected: string | null
  products: AnalyzedProduct[]
  ambients: AnalyzedAmbient[]
  series: SeriesInfo | null
  /** Resultado crudo del LLM (para depurar). */
  raw: ExtractionResult
}

// =============================================================================
// Matching de imágenes embebidas a candidatos
// =============================================================================

/**
 * Asigna cada candidato a una imagen embebida distinta minimizando la distancia
 * acumulada entre centros. Greedy: empareja primero los pares cercanos (umbral)
 * y luego reparte los sueltos.
 */
export function matchEmbeddedToCandidates(
  embedded: EmbeddedImage[],
  candidateBboxes: Array<BBox | null | undefined>,
  secondPassMaxDist = 0.32,
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
      pairs.push({ ci, ei, dist: Math.hypot(cx - img.cx, cy - img.cy) })
    }
  }
  pairs.sort((a, b) => a.dist - b.dist)
  const usedC = new Set<number>()
  const usedE = new Set<number>()
  const matches = new Map<number, EmbeddedImage>()
  // 1ª pasada: pares cercanos con umbral razonable.
  for (const p of pairs) {
    if (usedC.has(p.ci) || usedE.has(p.ei)) continue
    if (p.dist > 0.5) continue
    usedC.add(p.ci)
    usedE.add(p.ei)
    matches.set(p.ci, embedded[p.ei])
  }
  // 2ª pasada: candidatos sueltos a swatches sueltos, ACOTADA por distancia.
  // Antes era sin umbral y podía emparejar un producto con una imagen lejana
  // (una foto de estancia de la otra mitad del spread) y dar una "textura" que
  // en realidad era una habitación. Si no hay swatch cercano, mejor recortar.
  for (const p of pairs) {
    if (usedC.has(p.ci) || usedE.has(p.ei)) continue
    if (p.dist > secondPassMaxDist) continue
    usedC.add(p.ci)
    usedE.add(p.ei)
    matches.set(p.ci, embedded[p.ei])
  }
  return matches
}

/** ¿El centro de la imagen embebida cae dentro de alguna región de entorno? */
function centerInsideAny(img: EmbeddedImage, regions: BBox[]): boolean {
  for (const r of regions) {
    if (img.cx >= r[0] && img.cx <= r[2] && img.cy >= r[1] && img.cy <= r[3]) return true
  }
  return false
}

/**
 * Mejor micro-baldosa embebida para una muestra: la de MAYOR área cuyo centro
 * cae dentro del bbox (ligeramente expandido) o muy cerca de su centro, sin
 * estar en un entorno ni ya usada. Para swatches compuestos de mosaico, una
 * baldosa individual es la textura a calidad de imprenta de esa variante.
 */
function bestMicroInBbox(
  micro: EmbeddedImage[],
  bbox: BBox,
  ambientRegions: BBox[],
  used: Set<EmbeddedImage>,
): EmbeddedImage | null {
  const cx = (bbox[0] + bbox[2]) / 2
  const cy = (bbox[1] + bbox[3]) / 2
  const [ex1, ey1, ex2, ey2] = [bbox[0] - 0.01, bbox[1] - 0.01, bbox[2] + 0.01, bbox[3] + 0.01]
  let best: EmbeddedImage | null = null
  let bestArea = 0
  for (const m of micro) {
    if (used.has(m)) continue
    if (centerInsideAny(m, ambientRegions)) continue
    const inside = m.cx >= ex1 && m.cx <= ex2 && m.cy >= ey1 && m.cy <= ey2
    const near = Math.hypot(m.cx - cx, m.cy - cy) <= 0.05
    if (!inside && !near) continue
    const area = m.width * m.height
    if (area > bestArea) {
      bestArea = area
      best = m
    }
  }
  return best
}

/**
 * Imagen embebida que mejor representa un entorno: la más grande y cercana al
 * bbox propuesto por el LLM, con aspecto fotográfico. Filtra las ya usadas.
 */
export function findAmbientImage(
  embedded: EmbeddedImage[],
  alreadyUsed: Set<EmbeddedImage>,
  ambientBboxHint?: BBox | null,
): EmbeddedImage | null {
  const candidates = embedded.filter((img) => !alreadyUsed.has(img))
  if (candidates.length === 0) return null

  if (ambientBboxHint) {
    const cx = (ambientBboxHint[0] + ambientBboxHint[2]) / 2
    const cy = (ambientBboxHint[1] + ambientBboxHint[3]) / 2
    // Solo consideramos imágenes cuyo centro cae razonablemente dentro del bbox
    // del entorno (evita coger una textura de la otra mitad del spread).
    const within = candidates.filter(
      (img) => Math.hypot(img.cx - cx, img.cy - cy) < 0.45,
    )
    const pool = within.length > 0 ? within : candidates
    let best: EmbeddedImage | null = null
    let bestScore = -Infinity
    for (const img of pool) {
      const dist = Math.hypot(img.cx - cx, img.cy - cy)
      const area = img.width * img.height
      const score = area / 1_000_000 - dist * 3
      if (score > bestScore) {
        bestScore = score
        best = img
      }
    }
    return best
  }

  let best: EmbeddedImage | null = null
  let bestArea = 0
  for (const img of candidates) {
    if (img.aspect < 0.4 || img.aspect > 2.8) continue
    const area = img.width * img.height
    if (area > bestArea) {
      bestArea = area
      best = img
    }
  }
  return best
}

// =============================================================================
// Recorte del render por bbox
// =============================================================================

/**
 * Recorta el render JPEG de la página con una bbox normalizada 0-1.
 *
 * A diferencia de la versión antigua, NO fuerza un aspecto cuadrado: el LLM
 * ahora recorta el rótulo, así que respetamos el rectángulo tal cual (un swatch
 * 7x28 es apaisado, una textura puede ser vertical). `trim` quita bordes
 * blancos solo cuando se pide (útil para swatches con holgura, peligroso para
 * fotos de estancia con paredes claras).
 */
export async function cropFromPage(
  pageJpeg: Buffer,
  bbox: BBox,
  opts: { marginPct?: number; trim?: boolean } = {},
): Promise<{ jpeg: Buffer; width: number; height: number } | null> {
  const marginPct = opts.marginPct ?? 0.004
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

  const left = Math.max(0, Math.min(W - 1, Math.round(x1 * W)))
  const top = Math.max(0, Math.min(H - 1, Math.round(y1 * H)))
  // Clamp ESTRICTO a los límites de la imagen: el redondeo de left + width podía
  // exceder W en 1px y sharp abortaba con "extract_area: bad extract area",
  // tirando la página entera. Nunca debe lanzar: ante un bbox imposible,
  // devolvemos null y el producto se queda sin textura (recuperable en revisión).
  const width = Math.min(Math.round((x2 - x1) * W), W - left)
  const height = Math.min(Math.round((y2 - y1) * H), H - top)
  if (width < 24 || height < 24) return null

  const extractRegion = { left, top, width, height }
  try {
    let buf = await sharp(pageJpeg)
      .extract(extractRegion)
      .jpeg({ quality: 92 })
      .toBuffer()
    if (opts.trim) {
      // trim puede fallar/“comerse” una muestra casi uniforme (un blanco):
      // si peta o deja algo inválido, nos quedamos con el recorte sin trim.
      try {
        const trimmed = await sharp(buf).trim({ background: 'white', threshold: 18 }).jpeg({ quality: 92 }).toBuffer()
        const tm = await sharp(trimmed).metadata()
        if ((tm.width || 0) >= 24 && (tm.height || 0) >= 24) buf = trimmed
      } catch {
        /* nos quedamos con el recorte sin trim */
      }
    }
    const m = await sharp(buf).metadata()
    return { jpeg: buf, width: m.width || width, height: m.height || height }
  } catch {
    return null
  }
}

// =============================================================================
// pageType helpers
// =============================================================================

/** Tipos de página que por definición no presentan variantes individuales. */
const NO_PRODUCT_PAGE_TYPES = new Set<PageType>([
  'cover',
  'index',
  'graphic-variation',
  'special-pieces',
  'other',
])

/** Tipos de página que pueden contener fotos de estancia (entornos). */
const AMBIENT_PAGE_TYPES = new Set<PageType>(['ambient', 'intro', 'texture', 'palette'])

// =============================================================================
// Análisis de página
// =============================================================================

export type AnalyzeOptions = {
  /** Umbral mínimo (px) para considerar una imagen embebida (filtra micro-tiles/iconos). */
  embeddedMinW?: number
  embeddedMinH?: number
  /** Resolución del lado largo para la imagen que ve el LLM. */
  llmMaxSide?: number
}

export async function analyzePage(
  doc: any,
  page: PageData,
  extractor: VisionExtractor,
  opts: AnalyzeOptions = {},
): Promise<PageAnalysis> {
  const embeddedMinW = opts.embeddedMinW ?? 120
  const embeddedMinH = opts.embeddedMinH ?? 120
  // 1568 ≈ 2×768 (tamaño de tile de Gemini): más resolución mejora mucho la
  // precisión de las bboxes en páginas densas (rejillas de muchos swatches).
  const llmMaxSide = opts.llmMaxSide ?? 1568

  // 1. Imágenes embebidas. Extraemos a umbral BAJO para capturar también las
  //    micro-baldosas con las que algunos catálogos componen los swatches
  //    (HAMPTONS: cada muestra "7x28" es un mosaico de bricks de ~111×28; con el
  //    umbral 120 se perdían y la textura caía a un crop de la etiqueta). Luego
  //    partimos en pool "limpio" (swatches a página, ≥ umbral) y micro-pool.
  const microMinW = Math.min(embeddedMinW, 60)
  const microMinH = Math.min(embeddedMinH, 24)
  const allEmbedded = await extractEmbeddedImages(doc, page.pageNumber, {
    minWidth: microMinW,
    minHeight: microMinH,
  })
  const isClean = (img: EmbeddedImage) => img.width >= embeddedMinW && img.height >= embeddedMinH
  const cleanEmbedded = allEmbedded.filter(isClean)
  const microEmbedded = allEmbedded.filter((img) => !isClean(img))

  // 2. Separar entornos candidatos (área >> mediana) de swatches limpios. La
  //    separación se hace SOLO sobre el pool limpio: las micro-baldosas nunca
  //    son entornos y sesgarían la mediana.
  let swatches: EmbeddedImage[] = cleanEmbedded
  let ambientCandidates: EmbeddedImage[] = []
  if (cleanEmbedded.length >= 2) {
    const areas = cleanEmbedded.map((img) => img.width * img.height)
    const sorted = [...areas].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    ambientCandidates = cleanEmbedded.filter((img) => img.width * img.height >= median * 2.5)
    swatches = cleanEmbedded.filter((img) => !ambientCandidates.includes(img))
  }

  // 3. LLM sobre el render reducido.
  const lowRes = await sharp(page.renderJpeg)
    .resize(llmMaxSide, llmMaxSide, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer()
  const raw = await extractor.extract(lowRes.toString('base64'), page.text)

  const pageType = (raw.pageType || null) as PageType | null
  const pageHasProducts = !pageType || !NO_PRODUCT_PAGE_TYPES.has(pageType)
  const products = pageHasProducts
    ? (raw.products || []).filter((p) => p.variantName?.trim())
    : []
  const candidateBboxes = products.map((p) => p.textureBbox)

  // 4. Matching swatch ↔ candidato. Si no hay swatch embebido (HAMPTONS: el
  //    swatch es un mosaico de micro-tiles filtrado), se recorta del render.
  //    Excluimos del pool las imágenes que caen dentro de una región de entorno
  //    marcada por el LLM: así un producto no puede acabar con una foto de
  //    estancia como "textura" (le pasaba a Hamptons Beige).
  const ambientRegions = (raw.ambients || [])
    .map((a) => a.bbox)
    .filter((b): b is BBox => Array.isArray(b) && b.length === 4)
  const swatchPool = swatches.filter((img) => !centerInsideAny(img, ambientRegions))
  const candidateMatches = matchEmbeddedToCandidates(swatchPool, candidateBboxes)
  const usedEmbedded = new Set<EmbeddedImage>()
  for (const img of candidateMatches.values()) usedEmbedded.add(img)
  const usedMicro = new Set<EmbeddedImage>()

  const analyzedProducts: AnalyzedProduct[] = []
  for (let idx = 0; idx < products.length; idx++) {
    const p = products[idx]
    const matched = candidateMatches.get(idx)
    let texture: AnalyzedTexture | null = null
    if (matched) {
      // Mejor caso: swatch embebido limpio (CORE TECH, NewTiles).
      texture = {
        jpeg: matched.jpeg,
        source: 'embedded',
        width: matched.width,
        height: matched.height,
        area: matched.width * matched.height,
      }
    } else if (p.textureBbox) {
      // Fallback 1: micro-baldosa embebida dentro del bbox de la muestra. Es
      // textura a calidad de imprenta (una baldosa del mosaico que compone el
      // swatch) — mucho mejor que recortar la etiqueta del render (HAMPTONS).
      const micro = bestMicroInBbox(microEmbedded, p.textureBbox, ambientRegions, usedMicro)
      if (micro) {
        usedMicro.add(micro)
        texture = {
          jpeg: micro.jpeg,
          source: 'embedded',
          width: micro.width,
          height: micro.height,
          area: micro.width * micro.height,
        }
      } else {
        // Fallback 2: recorte del render por bbox.
        const crop = await cropFromPage(page.renderJpeg, p.textureBbox, { trim: true })
        if (crop) {
          texture = {
            jpeg: crop.jpeg,
            source: 'crop',
            width: crop.width,
            height: crop.height,
            area: crop.width * crop.height,
          }
        }
      }
    }
    analyzedProducts.push({ product: p, texture })
  }

  // 5. Entornos: una entrada por foto de estancia. Solo en páginas que pueden
  //    tenerlos y solo si hay con quién enlazarlos (producto en la página o
  //    callout que nombre una variante de otra página).
  const analyzedAmbients: AnalyzedAmbient[] = []
  const regions: AmbientRegion[] = pageType && !AMBIENT_PAGE_TYPES.has(pageType) ? [] : raw.ambients || []
  for (const region of regions) {
    const names = (region.products || []).filter(Boolean)
    if (products.length === 0 && names.length === 0) continue // entorno huérfano: no se puede enlazar
    let img: AnalyzedAmbient | null = null
    const embedded = findAmbientImage(
      ambientCandidates.length > 0 ? ambientCandidates : allEmbedded,
      usedEmbedded,
      region.bbox,
    )
    if (embedded) {
      usedEmbedded.add(embedded)
      img = {
        jpeg: embedded.jpeg,
        source: 'embedded',
        width: embedded.width,
        height: embedded.height,
        productNames: names,
        surfaces: region.surfaces || [],
      }
    } else {
      const crop = await cropFromPage(page.renderJpeg, region.bbox, { trim: false })
      if (crop) {
        img = {
          jpeg: crop.jpeg,
          source: 'crop',
          width: crop.width,
          height: crop.height,
          productNames: names,
          surfaces: region.surfaces || [],
        }
      }
    }
    if (img) analyzedAmbients.push(img)
  }

  return {
    pageNumber: page.pageNumber,
    pageType,
    brandDetected: raw.brandDetected ?? null,
    collectionDetected: raw.collectionDetected ?? null,
    products: analyzedProducts,
    ambients: analyzedAmbients,
    series: raw.series ?? null,
    raw,
  }
}
