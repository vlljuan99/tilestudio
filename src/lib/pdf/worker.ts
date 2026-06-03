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
 */
import { getPayload } from 'payload'
import OpenAI from 'openai'
import sharp from 'sharp'
import config from '@payload-config'
import { loadPdf, iteratePages, getTotalPages } from './extractor'

const MODEL = 'gpt-4o-mini'

export type Candidate = {
  id: string
  /** página del PDF donde aparece (1-based) */
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
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la textura de esta variante en la página. */
  textureBbox?: [number, number, number, number] | null
  /** Crop de la textura. */
  textureImageUrl?: string
  textureMediaId?: number | string
  /** Crop de la foto ambiente compartida con todas las variantes de la misma página. */
  ambientImageUrl?: string
  ambientMediaId?: number | string
  /** Página completa (fallback para revisión). */
  pageImageUrl?: string
  pageMediaId?: number | string
  reviewStatus: 'pending' | 'accepted' | 'rejected'
}

type BBox = [number, number, number, number]
type LLMProduct = Omit<
  Candidate,
  'id' | 'page' | 'reviewStatus' | 'pageImageUrl' | 'textureImageUrl' | 'ambientImageUrl'
>

type ExtractionResult = {
  products: LLMProduct[]
  brandDetected?: string | null
  collectionDetected?: string | null
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la foto ambiente principal de la página (si la hay). */
  ambientBbox?: BBox | null
}

const SYSTEM_PROMPT = `Eres un asistente que extrae información de catálogos de azulejos de fabricantes españoles.

Recibirás la imagen de una o dos páginas (un spread) de un catálogo en PDF.
Tu tarea es identificar cada AZULEJO PRESENTADO COMO VARIANTE INDIVIDUAL y devolver, para cada uno, su información Y las coordenadas de su textura en la imagen, junto con la coordenada de la foto ambiente si existe.

Reglas de contenido:
- Una "serie" o "colección" puede contener varias variantes (ej. "Alloy" contiene Alloy Azzurro, Alloy Pearl, Alloy Mint, etc.). Cada variante es un producto separado.
- Si en la página solo hay texto introductorio sin productos identificables, devuelve products: [].
- Los formatos van en cm (ej. "60x120", "30x90", "20x20"). Excluye pulgadas.
- Los acabados típicos: Matt, Lapatto, Brillo, Pulido, Satinado, Antideslizante.
- El SKU/código (ej. "SOL23", "SOL28") suele aparecer en la columna "Cód. tarif." y aplica al formato. Si hay varios, devuélvelos como string concatenado.
- Usos: "suelo interior", "pared baño", "pared cocina", "exterior". Infiérelos por las normas R10/R11 y por contexto visual.
- Estancias: baño, cocina, salón, dormitorio, exterior. Infiérelas por las fotos ambiente.

Reglas de coordenadas (CRÍTICO):
- Todas las coordenadas son normalizadas 0-1: x1 e y1 esquina superior izquierda, x2 e y2 esquina inferior derecha, sobre la imagen completa que recibes.
- "ambientBbox": el rectángulo que encierra la foto FOTOGRÁFICA de la estancia con muebles. Si no hay foto ambiente, devuelve null.
- "textureBbox" (por cada variante): el rectángulo que encierra la textura/swatch de ESA variante (sin nombre debajo, sin marco). Cada variante tiene su propio rectángulo distinto del de las demás.
- Si no puedes determinar con seguridad la bbox de una variante, devuelve null para esa textureBbox.

Devuelve JSON estricto con esta forma:
{
  "brandDetected": "Pamesa" | null,
  "collectionDetected": "Solid" | null,
  "ambientBbox": [0.05, 0.12, 0.45, 0.88] | null,
  "products": [
    {
      "seriesName": "Alloy",
      "variantName": "Alloy Azzurro",
      "sku": "SOL23 / SOL28",
      "formats": ["60x120", "60x60"],
      "finishes": ["Matt", "Lapatto"],
      "dominantColor": "azul/turquesa metálico",
      "description": "Apariencia metálica oxidada en tono azul-turquesa.",
      "usage": ["pared baño", "suelo interior"],
      "rooms": ["baño"],
      "textureBbox": [0.51, 0.18, 0.68, 0.34]
    }
  ]
}`

async function callVisionLLM(
  client: OpenAI,
  imageBase64: string,
  pageText: string,
): Promise<ExtractionResult> {
  const response = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Texto extraído de la página (úsalo como referencia para nombres y códigos exactos):\n\n${pageText.slice(0, 4000)}`,
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
          },
        ],
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) return { products: [] }
  try {
    return JSON.parse(content) as ExtractionResult
  } catch (err) {
    console.warn('No se pudo parsear JSON de la LLM:', content.slice(0, 200))
    return { products: [] }
  }
}

function makeCandidateId(page: number, idx: number): string {
  return `p${page}_${idx}_${Math.random().toString(36).slice(2, 8)}`
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
  if (!media?.url) throw new Error('PDF Media no tiene URL')
  const base = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const url = media.url.startsWith('http') ? media.url : `${base}${media.url}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`No se pudo descargar el PDF: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

export async function runPdfImport(importId: number | string) {
  const payload = await getPayload({ config })

  // Load import doc
  const importDoc = (await payload.findByID({ collection: 'pdf-imports', id: importId })) as any
  if (!importDoc) {
    console.error('PdfImport not found:', importId)
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: { status: 'failed', errorMessage: 'Falta OPENAI_API_KEY en .env' } as any,
    })
    return
  }
  const openai = new OpenAI({ apiKey })

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
        totalPages,
        currentStep: `Procesando páginas ${fromPage}–${effectiveTo} (${pagesToProcess})…`,
      } as any,
    })

    const doc = await loadPdf(pdfBuffer)
    const allCandidates: Candidate[] = []
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

      // Llamada al LLM con versión reducida (controla coste de tokens de imagen).
      // El render original a alta resolución se reserva para los crops finales.
      try {
        const lowResForLlm = await sharp(page.renderJpeg)
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer()
        const base64 = lowResForLlm.toString('base64')
        const result = await callVisionLLM(openai, base64, page.text)

        if (!brandDetected && result.brandDetected) brandDetected = result.brandDetected
        if (!collectionDetected && result.collectionDetected) {
          collectionDetected = result.collectionDetected
        }

        // Recortar ambient (compartido para todos los candidatos de esta página)
        let sharedAmbient: { id: number | string; url: string } | undefined
        if (result.ambientBbox) {
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

        const newCandidates: Candidate[] = []
        for (let idx = 0; idx < (result.products || []).length; idx++) {
          const p = result.products[idx]

          // Recortar textura específica del candidato
          let texture: { id: number | string; url: string } | undefined
          if (p.textureBbox) {
            const tCrop = await cropFromPage(page.renderJpeg, p.textureBbox)
            if (tCrop) {
              const safeName = p.variantName
                .toLowerCase()
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
              texture = await uploadMedia(
                payload,
                tCrop,
                `pdf-import-${importId}-p${page.pageNumber}-${safeName}.jpg`,
                `Textura ${p.variantName}`,
              )
            }
          }

          newCandidates.push({
            id: makeCandidateId(page.pageNumber, idx),
            page: page.pageNumber,
            brand: result.brandDetected ?? brandDetected,
            collection: result.collectionDetected ?? collectionDetected,
            pageImageUrl: pageMedia?.url,
            pageMediaId: pageMedia?.id,
            ambientImageUrl: sharedAmbient?.url,
            ambientMediaId: sharedAmbient?.id,
            textureImageUrl: texture?.url,
            textureMediaId: texture?.id,
            reviewStatus: 'pending',
            ...p,
          })
        }

        allCandidates.push(...newCandidates)

        await payload.update({
          collection: 'pdf-imports',
          id: importId,
          data: {
            extractedItems: allCandidates,
            candidatesCount: allCandidates.length,
            currentStep: `Página ${page.pageNumber}: ${newCandidates.length} candidatos`,
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

    await payload.update({
      collection: 'pdf-imports',
      id: importId,
      data: {
        status: 'review_ready',
        completedAt: new Date().toISOString(),
        progressPercent: 100,
        currentStep: `Listo. ${allCandidates.length} candidatos a revisar.`,
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
