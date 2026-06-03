import { getRenderingProvider } from '../lib/ai/renderer'
import { readFileSync } from 'fs'
import { join } from 'path'

const provider = getRenderingProvider()
console.log('Provider:', provider.id)

const base = readFileSync(join(process.cwd(), 'media', 'pdf-import-4-p4-ardesia-noir.jpg'))
const texture = readFileSync(join(process.cwd(), 'media', 'pdf-import-4-p4-ardesia-noir.jpg'))

try {
  const result = await provider.generate({
    baseImage: base,
    baseImageMimeType: 'image/jpeg',
    placements: [{ surface: 'floor', tileName: 'Ardesia Noir', textureImage: texture }],
  })
  console.log('OK mimeType=', result.mimeType, 'bytes=', result.imageBuffer.length, 'latency=', result.latencyMs, 'ms')
} catch (e: any) {
  console.error('ERROR:', e?.message ?? e)
  if (e?.status) console.error('status:', e.status)
}
