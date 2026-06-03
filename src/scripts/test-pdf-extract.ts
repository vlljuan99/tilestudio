/**
 * Test rápido del extractor de PDF.
 * Uso: npx tsx src/scripts/test-pdf-extract.ts "ruta/al.pdf" [fromPage=170] [toPage=175]
 *
 * Vuelca info de cada página + guarda los JPEG renderizados en /tmp/pdf-pages/.
 */
import { readFile, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { loadPdf, iteratePages, getTotalPages } from '../lib/pdf/extractor'

async function main() {
  const pdfPath = process.argv[2] || 'C:/Users/jvill/Downloads/170-311 SOLID web.pdf'
  const fromPage = Number(process.argv[3] || 170)
  const toPage = Number(process.argv[4] || 173)

  console.log(`Cargando PDF: ${pdfPath}`)
  const buffer = await readFile(pdfPath)
  console.log(`  Tamaño: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`)

  const total = await getTotalPages(buffer)
  console.log(`  Total páginas: ${total}`)

  const doc = await loadPdf(buffer)
  console.log(`Procesando páginas ${fromPage}–${toPage}…`)

  const outDir = path.join(process.cwd(), 'tmp', 'pdf-pages')
  await mkdir(outDir, { recursive: true })

  let count = 0
  for await (const page of iteratePages(doc, fromPage, toPage)) {
    count++
    console.log(
      `  p.${page.pageNumber}: ${page.text.length} chars, jpeg ${(page.renderJpeg.length / 1024).toFixed(0)} KB`,
    )
    console.log(`    text excerpt: "${page.text.slice(0, 200)}..."`)
    const outPath = path.join(outDir, `p${page.pageNumber.toString().padStart(4, '0')}.jpg`)
    await writeFile(outPath, page.renderJpeg)
  }

  await doc.destroy()
  console.log(`\n✅ ${count} páginas extraídas. JPEGs en ${outDir}`)
}

main().catch((err) => {
  console.error('❌', err)
  process.exit(1)
})
