/**
 * Extractor de PDFs de catálogos de azulejos.
 *
 * Para cada página:
 *   - Extrae el texto completo (con posiciones).
 *   - Renderiza la página a JPEG en una resolución razonable (1280px lado largo).
 *   - Devuelve ambos para que el siguiente paso (vision LLM) los use.
 *
 * Diseñado para PDFs muy grandes (cientos de páginas, 80 MB+). Procesamos página
 * a página, sin cargar todo en memoria.
 */

// drizzle-kit (cargado por Payload) define Array.prototype.random como enumerable;
// pdfjs detecta esto como prototype pollution y se niega a arrancar. Lo silenciamos
// ANTES de importar pdfjs: redefinimos la propiedad como no-enumerable (sigue
// funcionando para quien la usa, pero ya no aparece en for...in).
for (const proto of [Array.prototype, Object.prototype, String.prototype]) {
  for (const key of Object.keys(proto)) {
    const desc = Object.getOwnPropertyDescriptor(proto, key)
    if (desc?.enumerable && desc.configurable) {
      Object.defineProperty(proto, key, { ...desc, enumerable: false })
    }
  }
}

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas, type Canvas } from '@napi-rs/canvas'
import sharp from 'sharp'

// CanvasFactory custom — pdfjs por defecto intenta `require('canvas')` (nativo).
// Nosotros le pasamos uno basado en @napi-rs/canvas, que es pure-Node.
class NapiCanvasFactory {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')
    const canvas = createCanvas(width, height)
    return {
      canvas,
      context: canvas.getContext('2d'),
    }
  }
  reset(canvasAndContext: { canvas: Canvas }, width: number, height: number) {
    if (!canvasAndContext.canvas) throw new Error('Canvas is not specified')
    if (width <= 0 || height <= 0) throw new Error('Invalid canvas size')
    canvasAndContext.canvas.width = width
    canvasAndContext.canvas.height = height
  }
  destroy(canvasAndContext: { canvas: Canvas | null; context: any }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0
      canvasAndContext.canvas.height = 0
      canvasAndContext.canvas = null
    }
    canvasAndContext.context = null
  }
}

const canvasFactory = new NapiCanvasFactory()

export type PageData = {
  pageNumber: number
  text: string
  width: number
  height: number
  /** JPEG buffer renderizado de la página */
  renderJpeg: Buffer
}

const RENDER_MAX_LONG_SIDE = 2400
const RENDER_JPEG_QUALITY = 92

export async function loadPdf(pdfBuffer: Buffer) {
  // pdfjs detaches el ArrayBuffer subyacente; clonamos para poder usar el buffer
  // múltiples veces si hace falta.
  const copy = new Uint8Array(pdfBuffer.length)
  copy.set(pdfBuffer)
  const loadingTask = pdfjs.getDocument({
    data: copy,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    CanvasFactory: NapiCanvasFactory as any,
  } as any)
  return loadingTask.promise
}

export async function getTotalPages(pdfBuffer: Buffer): Promise<number> {
  const doc = await loadPdf(pdfBuffer)
  const total = doc.numPages
  await doc.destroy()
  return total
}

/**
 * Extrae texto + render de una sola página.
 * Cierra recursos al terminar.
 */
export async function extractPage(
  doc: any /* PDFDocumentProxy */,
  pageNumber: number,
): Promise<PageData> {
  const page = await doc.getPage(pageNumber)

  // 1. Texto
  const textContent = await page.getTextContent()
  const text = textContent.items
    .map((it: any) => it.str)
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  // 2. Render a canvas
  const viewport = page.getViewport({ scale: 1 })
  const longSide = Math.max(viewport.width, viewport.height)
  const scale = RENDER_MAX_LONG_SIDE / longSide
  const scaled = page.getViewport({ scale })

  const canvas = createCanvas(scaled.width, scaled.height)
  const ctx = canvas.getContext('2d') as any

  await page.render({
    canvasContext: ctx,
    viewport: scaled,
    canvas: canvas as any,
  } as any).promise

  // canvas → PNG raw → JPEG comprimido (sharp es más rápido que canvas.toBuffer('image/jpeg'))
  const pngBuffer = canvas.toBuffer('image/png')
  const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: RENDER_JPEG_QUALITY }).toBuffer()

  page.cleanup()

  return {
    pageNumber,
    text,
    width: viewport.width,
    height: viewport.height,
    renderJpeg: jpegBuffer,
  }
}

/**
 * Async iterator que devuelve cada página en orden, sin acumular todas en memoria.
 *
 * Uso:
 *   const doc = await loadPdf(buf)
 *   for await (const page of iteratePages(doc, 1, 30)) {
 *     // page.text, page.renderJpeg, page.pageNumber
 *   }
 *   await doc.destroy()
 */
export async function* iteratePages(
  doc: any,
  fromPage: number,
  toPage: number,
): AsyncGenerator<PageData> {
  const safeFrom = Math.max(1, fromPage)
  const safeTo = Math.min(doc.numPages, toPage)
  for (let p = safeFrom; p <= safeTo; p++) {
    yield await extractPage(doc, p)
  }
}

// =============================================================================
// Imágenes embebidas
// =============================================================================

export type EmbeddedImage = {
  /** Índice en el operatorList (puede repetirse si el mismo XObject se pinta varias veces) */
  index: number
  /** Bbox normalizada al viewport de la página, clamped a [0,1] */
  bbox: { x1: number; y1: number; x2: number; y2: number }
  /** Centro de la bbox */
  cx: number
  cy: number
  /** Dimensiones reales del JPEG/raster embebido en el PDF */
  width: number
  height: number
  /** Aspect ratio width/height */
  aspect: number
  /** Buffer JPEG de la imagen */
  jpeg: Buffer
}

const PDFJS_OPS_PROMISE = import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => m.OPS)

/**
 * Extrae todas las imágenes embebidas (XObjects) de una página, junto con su
 * posición en la página.
 *
 * Útil para conseguir las texturas/ambientes a calidad original de imprenta
 * sin rasterizar la página entera.
 */
export async function extractEmbeddedImages(
  doc: any,
  pageNumber: number,
  options: {
    /** Anchura mínima (px) para considerar una imagen relevante. Filtra logos/iconos. */
    minWidth?: number
    /** Altura mínima (px). */
    minHeight?: number
  } = {},
): Promise<EmbeddedImage[]> {
  const minWidth = options.minWidth ?? 200
  const minHeight = options.minHeight ?? 150

  const ops = await PDFJS_OPS_PROMISE
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const VW = viewport.width
  const VH = viewport.height

  const opList = await page.getOperatorList()

  // CTM management
  let ctm: number[] = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []
  const mul = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]

  // Recolectamos refs (name + ctm + index) en una pasada
  type Ref = { index: number; name: string; ctm: number[] }
  const refs: Ref[] = []

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i]
    if (fn === ops.save) {
      stack.push([...ctm])
    } else if (fn === ops.restore) {
      ctm = stack.pop() || [1, 0, 0, 1, 0, 0]
    } else if (fn === ops.transform) {
      ctm = mul(ctm, args as number[])
    } else if (fn === ops.paintImageXObject || fn === ops.paintImageMaskXObject) {
      refs.push({ index: i, name: args[0], ctm: [...ctm] })
    }
  }

  const out: EmbeddedImage[] = []

  for (const ref of refs) {
    let img: any = null
    try {
      img = await new Promise((resolve, reject) => {
        try {
          const r = page.objs.get(ref.name, (data: any) => resolve(data))
          if (r) resolve(r)
        } catch (e) {
          reject(e)
        }
      })
    } catch {
      continue
    }
    if (!img?.data || !img.width || !img.height) continue
    if (img.width < minWidth || img.height < minHeight) continue

    // Calcular bbox del CTM
    const [a, b, c, d, e, f] = ref.ctm
    const wPt = Math.sqrt(a * a + b * b)
    const hPt = Math.sqrt(c * c + d * d)
    // pdfjs viewport origin top-left, PDF origin bottom-left → flip y
    const x1raw = e
    const y1raw = VH - f - hPt
    const x2raw = x1raw + wPt
    const y2raw = y1raw + hPt

    const x1 = Math.max(0, Math.min(1, x1raw / VW))
    const y1 = Math.max(0, Math.min(1, y1raw / VH))
    const x2 = Math.max(0, Math.min(1, x2raw / VW))
    const y2 = Math.max(0, Math.min(1, y2raw / VH))

    // Skip si la bbox queda fuera del viewport efectivo
    if (x2 - x1 < 0.02 || y2 - y1 < 0.02) continue

    // Convertir raw a JPEG con sharp
    let channels: 1 | 3 | 4 = 3
    if (img.kind === 1) channels = 1
    else if (img.kind === 2) channels = 3
    else if (img.kind === 3) channels = 4

    let jpeg: Buffer
    try {
      jpeg = await sharp(Buffer.from(img.data), {
        raw: { width: img.width, height: img.height, channels },
      })
        .jpeg({ quality: 92 })
        .toBuffer()
    } catch {
      continue
    }

    out.push({
      index: ref.index,
      bbox: { x1, y1, x2, y2 },
      cx: (x1 + x2) / 2,
      cy: (y1 + y2) / 2,
      width: img.width,
      height: img.height,
      aspect: img.width / img.height,
      jpeg,
    })
  }

  page.cleanup()
  return out
}
