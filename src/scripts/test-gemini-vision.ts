/**
 * Test directo del GeminiVisionExtractor sobre páginas concretas.
 * Uso: npx tsx --env-file=.env src/scripts/test-gemini-vision.ts [pdf] [from] [to]
 *
 * Salta toda la capa HTTP/Payload — útil para depurar el extractor de visión.
 */
import { readFile } from 'fs/promises'
import { loadPdf, iteratePages } from '../lib/pdf/extractor'
import sharp from 'sharp'
import { getVisionExtractor } from '../lib/ai/vision'

async function main() {
  const pdfPath = process.argv[2] || 'C:/Users/jvill/Downloads/170-311 SOLID web.pdf'
  const fromPage = Number(process.argv[3] || 2)
  const toPage = Number(process.argv[4] || 5)

  const extractor = getVisionExtractor()
  console.log(`Extractor: ${extractor.id}\n`)

  const buffer = await readFile(pdfPath)
  const doc = await loadPdf(buffer)

  for await (const page of iteratePages(doc, fromPage, toPage)) {
    console.log(`--- Página ${page.pageNumber} (${page.text.length} chars de texto, ${page.renderJpeg.length / 1024 | 0} KB jpeg) ---`)
    const startTs = Date.now()

    // Reducimos al tamaño que envía el worker (1280 max)
    const lowRes = await sharp(page.renderJpeg)
      .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer()
    const base64 = lowRes.toString('base64')

    try {
      const result = await extractor.extract(base64, page.text)
      const ms = Date.now() - startTs
      console.log(`✓ ${ms}ms - brand=${result.brandDetected} col=${result.collectionDetected} products=${result.products.length}`)
      if (result.products.length > 0) {
        for (const p of result.products.slice(0, 3)) {
          console.log(`   • ${p.variantName} | sku=${p.sku} | formats=${p.formats?.join('/')} | bbox=${p.textureBbox?.map(n => n.toFixed(2)).join(',')}`)
        }
      }
    } catch (err) {
      const ms = Date.now() - startTs
      console.log(`✗ ${ms}ms - ERROR: ${(err as Error).message}`)
    }
  }

  await doc.destroy()
  process.exit(0)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
