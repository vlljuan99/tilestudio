/**
 * Test del extractor de paleta sobre una imagen local.
 * Uso: npx tsx --env-file=.env src/scripts/test-palette.ts <path-imagen>
 */
import { readFile } from 'fs/promises'
import { extractPaletteFromBuffer } from '../lib/palette'

async function main() {
  const path = process.argv[2]
  if (!path) {
    console.error('Falta path de imagen.')
    process.exit(1)
  }
  const buffer = await readFile(path)
  const palette = await extractPaletteFromBuffer(buffer)
  console.log('Paleta sugerida:')
  console.log(`  primary    = ${palette.primary}`)
  console.log(`  accent     = ${palette.accent}`)
  console.log(`  background = ${palette.background}`)
  console.log(`  surface    = ${palette.surface}`)
  console.log(`  text       = ${palette.text}`)
  console.log('\nColores detectados (todos):')
  for (const c of palette.all) {
    console.log(
      `  ${c.hex}  sat=${c.saturation.toFixed(2)}  lum=${c.luminance.toFixed(2)}  pop=${c.population}`,
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
