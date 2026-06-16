/**
 * Acumulador de candidatos a lo largo de las páginas de un catálogo.
 *
 * Resuelve tres problemas transversales a todos los catálogos:
 *   1. FUSIÓN: la misma variante aparece en varias páginas (paleta + textura a
 *      sangre + ficha técnica). Se fusiona por nombre normalizado quedándose con
 *      lo mejor de cada aparición (textura embebida > crop; mayor área gana).
 *   2. MULTI-ENTORNO: una variante puede salir en varias fotos de estancia
 *      (distintas páginas o el mismo spread con 2 fotos). Se acumulan TODAS.
 *   3. DATOS DE SERIE: formatos/acabados/piezas especiales que el catálogo lista
 *      una sola vez para toda la serie (NewTiles) se propagan a sus variantes.
 *
 * Es agnóstico al almacenamiento: recibe un `StoreFn` que sube/escribe un buffer
 * y devuelve una referencia opaca (id de Media en la web, ruta de fichero en el
 * harness). Así el worker y el banco de pruebas comparten la MISMA lógica.
 */
import type { PageAnalysis } from './page-analysis'
import type { SeriesInfo } from '../ai/vision'

export type StoredImage = { ref: string; url?: string }

export type StoreFn = (
  jpeg: Buffer,
  kind: 'texture' | 'ambient',
  meta: { variantName?: string; page: number; width?: number; height?: number },
) => Promise<StoredImage | undefined>

export type StoredCandidate = {
  id: string
  page: number
  pages: number[]
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
  textureRef?: string
  textureUrl?: string
  textureSource?: 'embedded' | 'crop'
  textureArea?: number
  /** Entornos (fotos de estancia) donde aparece la variante. Varios posibles. */
  ambientRefs: string[]
  ambientUrls: string[]
  pageRef?: string
  pageUrl?: string
  reviewStatus: 'pending' | 'accepted' | 'rejected'
  publishedTileId?: number | string | null
}

// -- Normalización --------------------------------------------------------------

/** Clave de fusión: nombre sin diacríticos (ō→o), minúsculas, espacios colapsados. */
export function candidateKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** "60X120 cm" / "60 × 120" / '24"x48"' → "60x120" para deduplicar formatos. */
export function normalizeFormat(f: string): string {
  return f
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/cm|mm/g, '')
    .replace(/["”″''`]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

/** "cōre ivory" / "CŌRE IVORY" → "Cōre Ivory". */
export function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
}

export function unionList(
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

function makeCandidateId(page: number, idx: number): string {
  return `p${page}_${idx}_${Math.random().toString(36).slice(2, 8)}`
}

// -- Store ----------------------------------------------------------------------

export class CandidateStore {
  readonly candidates: StoredCandidate[] = []
  private index = new Map<string, StoredCandidate>()
  /** Entornos a la espera de su variante (callout que nombra una variante futura). */
  private pendingAmbients = new Map<string, StoredImage[]>()
  /** Datos a nivel de serie a propagar a todas sus variantes. */
  private seriesData = new Map<string, SeriesInfo>()
  brand: string | null = null
  collection: string | null = null
  private counter = 0

  constructor(private store: StoreFn) {}

  /** Añade el análisis de una página. Sube las imágenes vía el StoreFn. */
  async addPage(
    analysis: PageAnalysis,
    pageImage?: StoredImage,
  ): Promise<{ added: number; merged: number }> {
    if (!this.brand && analysis.brandDetected) this.brand = analysis.brandDetected
    if (!this.collection && analysis.collectionDetected) this.collection = analysis.collectionDetected

    // 1. Crear/fusionar candidatos de producto de esta página.
    const pageCandidateKeys: string[] = []
    let added = 0
    let merged = 0
    for (const ap of analysis.products) {
      const p = ap.product
      let texture: StoredImage | undefined
      if (ap.texture) {
        texture = await this.store(ap.texture.jpeg, 'texture', {
          variantName: p.variantName,
          page: analysis.pageNumber,
          width: ap.texture.width,
          height: ap.texture.height,
        })
      }

      const cand: StoredCandidate = {
        id: makeCandidateId(analysis.pageNumber, this.counter++),
        page: analysis.pageNumber,
        pages: [analysis.pageNumber],
        brand: analysis.brandDetected ?? this.brand,
        collection: analysis.collectionDetected ?? this.collection,
        seriesName: p.seriesName ? titleCase(p.seriesName) : p.seriesName ?? null,
        variantName: titleCase(p.variantName),
        sku: p.sku ?? null,
        colorCode: p.colorCode ?? null,
        formats: p.formats || [],
        finishes: p.finishes || [],
        specialPieces: [],
        dominantColor: p.dominantColor ?? null,
        description: p.description ?? null,
        usage: p.usage || [],
        rooms: p.rooms || [],
        textureRef: texture?.ref,
        textureUrl: texture?.url,
        textureSource: ap.texture?.source,
        textureArea: ap.texture?.area || 0,
        ambientRefs: [],
        ambientUrls: [],
        pageRef: pageImage?.ref,
        pageUrl: pageImage?.url,
        reviewStatus: 'pending',
      }

      const key = candidateKey(cand.variantName)
      pageCandidateKeys.push(key)
      const existing = this.index.get(key)
      if (existing) {
        this.mergeInto(existing, cand)
        merged++
      } else {
        this.index.set(key, cand)
        this.candidates.push(cand)
        this.applyStoredSeries(cand)
        added++
      }
    }

    // 2. Entornos de la página.
    for (const amb of analysis.ambients) {
      const stored = await this.store(amb.jpeg, 'ambient', {
        page: analysis.pageNumber,
        width: amb.width,
        height: amb.height,
      })
      if (!stored) continue
      const names = amb.productNames
      if (names.length > 0) {
        // Enlazar con las variantes nombradas (ahora o cuando aparezcan).
        for (const name of names) {
          const key = candidateKey(name)
          if (!key) continue
          const target = this.index.get(key)
          if (target) {
            this.attachAmbient(target, stored)
          } else {
            const list = this.pendingAmbients.get(key) || []
            if (!list.some((s) => s.ref === stored.ref)) list.push(stored)
            this.pendingAmbients.set(key, list)
          }
        }
      } else {
        // Sin callouts: lo comparten todas las variantes de esta página.
        for (const key of pageCandidateKeys) {
          const target = this.index.get(key)
          if (target) this.attachAmbient(target, stored)
        }
      }
    }

    // 3. Datos de serie de la página → propagar a sus variantes. SOLO si la
    //    página no lista colores como productos: si los lista (paleta/rejilla
    //    tipo HAMPTONS), cada color ya trae su propio formato y no queremos
    //    volcarle TODOS los formatos de la colección.
    if (analysis.series && analysis.series.name && pageCandidateKeys.length === 0) {
      this.registerSeries(analysis.series)
    }

    // 4. Resolver entornos pendientes para las variantes ya conocidas.
    this.resolvePending()

    return { added, merged }
  }

  private attachAmbient(cand: StoredCandidate, img: StoredImage): void {
    if (cand.ambientRefs.includes(img.ref)) return
    cand.ambientRefs.push(img.ref)
    cand.ambientUrls.push(img.url || '')
  }

  private resolvePending(): void {
    for (const [key, imgs] of this.pendingAmbients) {
      const cand = this.index.get(key)
      if (!cand) continue
      for (const img of imgs) this.attachAmbient(cand, img)
      this.pendingAmbients.delete(key)
    }
  }

  private registerSeries(info: SeriesInfo): void {
    const name = info.name
    if (!name) return
    const key = candidateKey(name)
    if (!key) return
    const prev = this.seriesData.get(key)
    const merged: SeriesInfo = {
      name,
      formats: unionList(prev?.formats, info.formats, normalizeFormat),
      finishes: unionList(prev?.finishes, info.finishes),
      specialPieces: unionList(prev?.specialPieces, info.specialPieces),
      description: info.description || prev?.description || null,
    }
    this.seriesData.set(key, merged)
    // Aplicar a las variantes ya existentes de esta serie.
    for (const cand of this.candidates) {
      if (cand.seriesName && candidateKey(cand.seriesName) === key) {
        this.applySeries(cand, merged)
      }
    }
  }

  private applyStoredSeries(cand: StoredCandidate): void {
    if (!cand.seriesName) return
    const info = this.seriesData.get(candidateKey(cand.seriesName))
    if (info) this.applySeries(cand, info)
  }

  private applySeries(cand: StoredCandidate, info: SeriesInfo): void {
    cand.formats = unionList(cand.formats, info.formats, normalizeFormat)
    cand.finishes = unionList(cand.finishes, info.finishes)
    cand.specialPieces = unionList(cand.specialPieces, info.specialPieces)
    if (!cand.description && info.description) cand.description = info.description
  }

  /** Fusiona `incoming` dentro de `existing` (misma variante en otra página). */
  private mergeInto(existing: StoredCandidate, incoming: StoredCandidate): void {
    existing.pages = Array.from(new Set([...existing.pages, ...incoming.pages])).sort((a, b) => a - b)
    existing.formats = unionList(existing.formats, incoming.formats, normalizeFormat)
    existing.finishes = unionList(existing.finishes, incoming.finishes)
    existing.specialPieces = unionList(existing.specialPieces, incoming.specialPieces)
    existing.usage = unionList(existing.usage, incoming.usage)
    existing.rooms = unionList(existing.rooms, incoming.rooms)
    if (!existing.sku && incoming.sku) existing.sku = incoming.sku
    if (!existing.colorCode && incoming.colorCode) existing.colorCode = incoming.colorCode
    if (!existing.dominantColor && incoming.dominantColor) existing.dominantColor = incoming.dominantColor
    if (!existing.seriesName && incoming.seriesName) existing.seriesName = incoming.seriesName
    if (!existing.brand && incoming.brand) existing.brand = incoming.brand
    if (!existing.collection && incoming.collection) existing.collection = incoming.collection
    if ((incoming.description?.length || 0) > (existing.description?.length || 0)) {
      existing.description = incoming.description
    }
    if (!existing.pageRef && incoming.pageRef) {
      existing.pageRef = incoming.pageRef
      existing.pageUrl = incoming.pageUrl
    }

    // Textura: embebida gana a crop; a igualdad de origen, mayor área.
    const tier = (c: StoredCandidate) => (c.textureSource === 'embedded' ? 1 : 0)
    const incomingBetter =
      incoming.textureRef &&
      (!existing.textureRef ||
        tier(incoming) > tier(existing) ||
        (tier(incoming) === tier(existing) && (incoming.textureArea || 0) > (existing.textureArea || 0)))
    if (incomingBetter) {
      existing.textureRef = incoming.textureRef
      existing.textureUrl = incoming.textureUrl
      existing.textureSource = incoming.textureSource
      existing.textureArea = incoming.textureArea
    }

    // Entornos: unión.
    for (let i = 0; i < incoming.ambientRefs.length; i++) {
      const ref = incoming.ambientRefs[i]
      if (!existing.ambientRefs.includes(ref)) {
        existing.ambientRefs.push(ref)
        existing.ambientUrls.push(incoming.ambientUrls[i] || '')
      }
    }
  }
}
