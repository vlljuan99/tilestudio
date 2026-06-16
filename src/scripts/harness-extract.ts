/**
 * Banco de pruebas LOCAL del extractor de catálogos (sin Payload / sin BD).
 *
 * Ejecuta el MISMO núcleo que la web (analyzePage + CandidateStore) sobre un
 * rango de páginas de un PDF, vuelca las imágenes a disco y genera "contact
 * sheets" JPEG: una tira por variante con su textura, sus entornos y sus datos,
 * para inspección visual rápida. Itera hasta que la extracción sea correcta;
 * después el núcleo se conecta al worker de la web.
 *
 * Uso:
 *   npx tsx --env-file=.env src/scripts/harness-extract.ts <pdf> <from> <to> [etiqueta]
 */
import { readFile, mkdir, writeFile, rm } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { loadPdf, iteratePages, getTotalPages } from '../lib/pdf/extractor'
import { analyzePage } from '../lib/pdf/page-analysis'
import { CandidateStore, type StoreFn, type StoredCandidate } from '../lib/pdf/candidate-store'
import { getVisionExtractor } from '../lib/ai/vision'

const ROW_H = 210
const CELL = ROW_H - 16
const SHEET_W = 1700
const ROWS_PER_SHEET = 11

function esc(s: string): string {
  return (s || '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)
}

function fmtList(a?: string[]): string {
  return a && a.length ? a.join(', ') : '—'
}

/** Caption SVG con los datos del candidato. */
function captionSvg(v: StoredCandidate, w: number, h: number): Buffer {
  const nTex = v.textureRef ? `textura: ${v.textureSource}` : 'SIN TEXTURA'
  const nAmb = `entornos: ${v.ambientRefs.length}`
  const lines: Array<{ t: string; bold?: boolean; color?: string }> = [
    { t: `${v.variantName}  (p.${v.pages.join(',')})`, bold: true },
    { t: `serie: ${v.seriesName || '—'}  ·  marca: ${v.brand || '—'}  ·  col: ${v.collection || '—'}` },
    { t: `SKU: ${v.sku || '—'}   color: ${v.dominantColor || '—'} ${v.colorCode ? '(' + v.colorCode + ')' : ''}` },
    { t: `formatos: ${fmtList(v.formats)}` },
    { t: `acabados: ${fmtList(v.finishes)}` },
    { t: `piezas esp.: ${fmtList(v.specialPieces)}` },
    { t: `usos: ${fmtList(v.usage)}   estancias: ${fmtList(v.rooms)}` },
    {
      t: `${nTex}   ${nAmb}`,
      color: v.textureRef ? (v.textureSource === 'embedded' ? '#0a7d28' : '#b45309') : '#c01919',
    },
  ]
  const rows = lines
    .map((l, i) => {
      const y = 22 + i * 23
      return `<text x="6" y="${y}" font-family="sans-serif" font-size="${l.bold ? 17 : 14}" font-weight="${l.bold ? 700 : 400}" fill="${l.color || '#222'}">${esc(l.t)}</text>`
    })
    .join('')
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#ffffff"/>${rows}</svg>`
  return Buffer.from(svg)
}

function redBox(w: number, h: number): Buffer {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="#fde8e8" stroke="#c01919" stroke-width="2"/><text x="${w / 2}" y="${h / 2}" font-family="sans-serif" font-size="13" fill="#c01919" text-anchor="middle">sin imagen</text></svg>`
  return Buffer.from(svg)
}

async function thumb(file: string): Promise<Buffer> {
  return sharp(file).resize(CELL, CELL, { fit: 'contain', background: '#f3f3f3' }).toBuffer()
}

async function composeRow(v: StoredCandidate): Promise<Buffer> {
  const pad = 8
  const layers: sharp.OverlayOptions[] = []
  let x = pad

  // Textura
  if (v.textureRef) {
    layers.push({ input: await thumb(v.textureRef), left: x, top: pad })
  } else {
    layers.push({ input: redBox(CELL, CELL), left: x, top: pad })
  }
  x += CELL + pad

  // Entornos (hasta 3)
  const ambs = v.ambientRefs.slice(0, 3)
  for (const a of ambs) {
    layers.push({ input: await thumb(a), left: x, top: pad })
    x += CELL + pad
  }
  // hueco reservado para alinear captions aunque haya menos de 3 entornos
  x = pad + CELL + pad + 3 * (CELL + pad)

  // Caption
  const capW = SHEET_W - x - pad
  layers.push({ input: captionSvg(v, capW, ROW_H - 4), left: x, top: 2 })

  return sharp({ create: { width: SHEET_W, height: ROW_H, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .png()
    .toBuffer()
}

async function buildContactSheets(
  cands: StoredCandidate[],
  outDir: string,
  label: string,
): Promise<string[]> {
  const out: string[] = []
  for (let s = 0; s * ROWS_PER_SHEET < cands.length; s++) {
    const slice = cands.slice(s * ROWS_PER_SHEET, (s + 1) * ROWS_PER_SHEET)
    const rows = await Promise.all(slice.map(composeRow))
    const H = ROW_H * slice.length + 40
    const header = Buffer.from(
      `<svg width="${SHEET_W}" height="36" xmlns="http://www.w3.org/2000/svg"><rect width="${SHEET_W}" height="36" fill="#111"/><text x="10" y="24" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff">${esc(label)} — hoja ${s + 1} (${slice.length} variantes)</text></svg>`,
    )
    const layers: sharp.OverlayOptions[] = [{ input: header, left: 0, top: 0 }]
    slice.forEach((_, i) => layers.push({ input: rows[i], left: 0, top: 40 + i * ROW_H }))
    const file = path.join(outDir, `sheet-${String(s + 1).padStart(2, '0')}.jpg`)
    await sharp({ create: { width: SHEET_W, height: H, channels: 3, background: '#ffffff' } })
      .composite(layers)
      .jpeg({ quality: 86 })
      .toBuffer()
      .then((b) => writeFile(file, b))
    out.push(file)
  }
  return out
}

async function main() {
  const pdfPath = process.argv[2]
  const from = Number(process.argv[3] || 1)
  const to = Number(process.argv[4] || 30)
  const label = process.argv[5] || path.basename(pdfPath, '.pdf')

  if (!pdfPath) {
    console.error('Uso: harness-extract.ts <pdf> <from> <to> [etiqueta]')
    process.exit(1)
  }

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const outDir = path.join(process.cwd(), 'tmp', 'harness', slug)
  const imgDir = path.join(outDir, 'img')
  await rm(outDir, { recursive: true, force: true })
  await mkdir(imgDir, { recursive: true })

  const extractor = getVisionExtractor()
  console.log(`PDF: ${pdfPath}`)
  console.log(`Extractor: ${extractor.id}`)
  const buffer = await readFile(pdfPath)
  const total = await getTotalPages(buffer)
  const effTo = Math.min(to, total)
  console.log(`Total páginas PDF: ${total} · procesando ${from}–${effTo}\n`)

  const doc = await loadPdf(buffer)

  let imgCounter = 0
  const storeFn: StoreFn = async (jpeg, kind, meta) => {
    const name = `${String(imgCounter++).padStart(4, '0')}-${kind}-p${meta.page}.jpg`
    const file = path.join(imgDir, name)
    await writeFile(file, jpeg)
    return { ref: file, url: file }
  }
  const storeRef = async (jpeg: Buffer, name: string): Promise<{ ref: string; url: string }> => {
    const file = path.join(imgDir, name)
    await writeFile(file, jpeg)
    return { ref: file, url: file }
  }

  const storeInstance = new CandidateStore(storeFn)

  for await (const page of iteratePages(doc, from, effTo)) {
    process.stdout.write(`p.${page.pageNumber}… `)
    try {
      const analysis = await analyzePage(doc, page, extractor)
      const pageImg = await storeRef(
        await sharp(page.renderJpeg).jpeg({ quality: 80 }).toBuffer(),
        `page-${String(page.pageNumber).padStart(4, '0')}.jpg`,
      )
      const { added, merged } = await storeInstance.addPage(analysis, pageImg)
      console.log(
        `[${analysis.pageType || '?'}] prod=${analysis.products.length} amb=${analysis.ambients.length} (+${added}/~${merged})${analysis.series?.name ? ' serie:' + analysis.series.name : ''}`,
      )
    } catch (err) {
      console.log(`ERROR: ${(err as Error).message}`)
    }
  }

  await doc.destroy()

  const cands = storeInstance.candidates
  // Resumen
  const withTex = cands.filter((c) => c.textureRef).length
  const embTex = cands.filter((c) => c.textureSource === 'embedded').length
  const withAmb = cands.filter((c) => c.ambientRefs.length > 0).length
  const totalAmb = cands.reduce((s, c) => s + c.ambientRefs.length, 0)
  console.log(`\n=== ${label} ===`)
  console.log(`Variantes: ${cands.length}`)
  console.log(`  con textura: ${withTex} (embebida ${embTex} / crop ${withTex - embTex})`)
  console.log(`  con entorno: ${withAmb}  ·  entornos totales: ${totalAmb}`)
  const noTex = cands.filter((c) => !c.textureRef)
  if (noTex.length) console.log(`  ⚠ SIN textura: ${noTex.map((c) => c.variantName).join(', ')}`)

  const usage = extractor.getUsage()
  const cost = usage.reduce((s, u) => s + u.estimatedCostUsd, 0)
  console.log(`  IA: ${cost.toFixed(3)} $`)

  await writeFile(
    path.join(outDir, 'candidates.json'),
    JSON.stringify(cands, null, 2),
  )
  const sheets = await buildContactSheets(cands, outDir, label)
  console.log(`\n✅ Contact sheets:`)
  for (const s of sheets) console.log(`   ${s}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
