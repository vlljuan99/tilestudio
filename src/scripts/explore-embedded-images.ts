/**
 * Explora las imágenes embebidas en un PDF de catálogo.
 * Uso: npx tsx --env-file=.env src/scripts/explore-embedded-images.ts [pdf] [page=2]
 *
 * Por cada paintImageXObject encontrado, dumpea la imagen como JPEG y muestra
 * sus dimensiones y posición en la página.
 */
import { readFile, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { loadPdf } from '../lib/pdf/extractor'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

async function main() {
  const pdfPath = process.argv[2] || 'C:/Users/jvill/Downloads/170-311 SOLID web.pdf'
  const pageNum = Number(process.argv[3] || 2)

  console.log(`PDF: ${pdfPath}`)
  console.log(`Página: ${pageNum}\n`)

  const buffer = await readFile(pdfPath)
  const doc = await loadPdf(buffer)
  const page = await doc.getPage(pageNum)
  const viewport = page.getViewport({ scale: 1 })
  console.log(`Viewport: ${viewport.width.toFixed(0)} × ${viewport.height.toFixed(0)} pt`)

  const operatorList = await page.getOperatorList()
  const ops = pdfjs.OPS
  const fnNames: Record<number, string> = {}
  for (const [name, code] of Object.entries(ops)) {
    fnNames[code as number] = name
  }

  // CTM stack management
  const ctmStack: number[][] = []
  let ctm = [1, 0, 0, 1, 0, 0]

  const mul = (a: number[], b: number[]): number[] => [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]

  const imageRefs: Array<{
    name: string
    ctm: number[]
    bbox: { x1: number; y1: number; x2: number; y2: number }
  }> = []

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i]
    const args = operatorList.argsArray[i]

    if (fn === ops.save) {
      ctmStack.push([...ctm])
    } else if (fn === ops.restore) {
      ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0]
    } else if (fn === ops.transform) {
      ctm = mul(ctm, args as number[])
    } else if (fn === ops.paintImageXObject || fn === ops.paintImageMaskXObject) {
      const imgName = args[0]
      // Las imágenes pintadas en PDF se dibujan en el cuadrante (0,0)–(1,1)
      // tras aplicar el CTM. El CTM tiene la forma [a b c d e f] donde:
      //   (a, b) = vector "x" de la imagen, (c, d) = vector "y", (e, f) = origen.
      // El ancho real = sqrt(a²+b²), alto = sqrt(c²+d²). Origen abajo-izquierda.
      const ox = ctm[4]
      const oy = ctm[5]
      const w = Math.sqrt(ctm[0] ** 2 + ctm[1] ** 2)
      const h = Math.sqrt(ctm[2] ** 2 + ctm[3] ** 2)
      // Convertimos a coords donde origen es arriba-izquierda (como pdfjs viewport)
      const x1 = ox
      const y1 = viewport.height - oy - h
      const x2 = x1 + w
      const y2 = y1 + h
      imageRefs.push({ name: imgName, ctm: [...ctm], bbox: { x1, y1, x2, y2 } })
    }
  }

  console.log(`\nImágenes encontradas: ${imageRefs.length}\n`)

  const outDir = path.join(process.cwd(), 'tmp', 'embedded-images')
  await mkdir(outDir, { recursive: true })

  for (let i = 0; i < imageRefs.length; i++) {
    const { name, bbox } = imageRefs[i]
    const wPt = bbox.x2 - bbox.x1
    const hPt = bbox.y2 - bbox.y1
    const nx1 = bbox.x1 / viewport.width
    const ny1 = bbox.y1 / viewport.height
    const nx2 = bbox.x2 / viewport.width
    const ny2 = bbox.y2 / viewport.height

    try {
      const img: any = await new Promise((resolve, reject) => {
        try {
          const r = page.objs.get(name, (data: any) => resolve(data))
          if (r) resolve(r)
        } catch (e) {
          reject(e)
        }
      })

      if (!img) {
        console.log(`  [${i}] ${name}: sin datos`)
        continue
      }

      const pw = img.width || 0
      const ph = img.height || 0
      const kind = img.kind
      const dataSize = img.data?.length || 0

      console.log(
        `  [${i}] ${name}: ${pw}×${ph} px · kind=${kind} · ${(dataSize / 1024) | 0} KB · pos ${nx1.toFixed(2)},${ny1.toFixed(2)} → ${nx2.toFixed(2)},${ny2.toFixed(2)} (en pt: ${wPt.toFixed(0)}×${hPt.toFixed(0)})`,
      )

      // Convertir a JPEG con sharp. img.kind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
      // (https://github.com/mozilla/pdf.js/blob/master/src/shared/util.js)
      if (pw > 0 && ph > 0 && img.data) {
        let channels: 1 | 3 | 4 = 3
        if (kind === 1) channels = 1
        else if (kind === 2) channels = 3
        else if (kind === 3) channels = 4

        try {
          const jpeg = await sharp(Buffer.from(img.data), {
            raw: { width: pw, height: ph, channels },
          })
            .jpeg({ quality: 92 })
            .toBuffer()

          const filename = `p${pageNum}_${i.toString().padStart(2, '0')}_${pw}x${ph}.jpg`
          await writeFile(path.join(outDir, filename), jpeg)
          console.log(`     → guardado ${filename} (${(jpeg.length / 1024) | 0} KB)`)
        } catch (err) {
          console.log(`     ✗ no se pudo convertir: ${(err as Error).message}`)
        }
      }
    } catch (err) {
      console.log(`  [${i}] ${name}: ERROR — ${(err as Error).message}`)
    }
  }

  page.cleanup()
  await doc.destroy()
  console.log(`\n✅ Imágenes guardadas en ${outDir}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
