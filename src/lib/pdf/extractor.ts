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
