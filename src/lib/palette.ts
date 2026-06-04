/**
 * Extracción de paleta de colores de una imagen (típicamente un logo).
 *
 * Devuelve los 6 colores dominantes con un nombre semántico, y sobre esos
 * decide qué color sirve mejor como "principal" del sitio, "acento", etc.
 *
 * Usa node-vibrant (port del algoritmo Palette de Android).
 */
import { Vibrant } from 'node-vibrant/node'
import sharp from 'sharp'

export type ExtractedColor = {
  hex: string
  /** Luminosidad percibida 0–1 (0 negro, 1 blanco). */
  luminance: number
  /** Saturación HSL 0–1. */
  saturation: number
  /** Población relativa del color en la imagen (cuántos píxeles dominan). */
  population: number
}

export type PaletteSuggestion = {
  /** Color principal (botones, enlaces). Suele ser el más vivo del logo. */
  primary: string
  /** Acento o secundario. */
  accent: string
  /** Color de fondo (claro). */
  background: string
  /** Color de texto principal (oscuro). */
  text: string
  /** Color de superficie / tarjeta (entre background y un poco más oscuro). */
  surface: string
  /** Todos los colores detectados, por orden de relevancia visual. */
  all: ExtractedColor[]
}

function relLuminance(r: number, g: number, b: number): number {
  // Luminancia percibida según WCAG
  const a = [r, g, b].map((v) => {
    v = v / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }
  return [h, s, l]
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')
}

function rgbFromHex(hex: string): [number, number, number] {
  const c = hex.replace('#', '')
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ]
}

/**
 * Sube o baja la luminosidad de un color manteniendo el tono y la saturación.
 * delta positivo aclara, delta negativo oscurece (-1 a 1).
 */
export function shiftLightness(hex: string, delta: number): string {
  const [r, g, b] = rgbFromHex(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  const newL = Math.max(0, Math.min(1, l + delta))
  // HSL → RGB
  function hue2rgb(p: number, q: number, t: number) {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  if (s === 0) {
    const v = Math.round(newL * 255)
    return toHex(v, v, v)
  }
  const q = newL < 0.5 ? newL * (1 + s) : newL + s - newL * s
  const p = 2 * newL - q
  const hh = h / 360
  const nr = hue2rgb(p, q, hh + 1 / 3) * 255
  const ng = hue2rgb(p, q, hh) * 255
  const nb = hue2rgb(p, q, hh - 1 / 3) * 255
  return toHex(nr, ng, nb)
}

/**
 * Devuelve los colores dominantes de la imagen.
 * Si el logo está sobre un fondo blanco/transparente, ignoramos colores casi-blancos
 * porque no aportan al branding.
 */
export async function extractPaletteFromBuffer(
  imageBuffer: Buffer,
): Promise<PaletteSuggestion> {
  // Pre-procesado: redimensionar a 300x300 max y aplanar transparencia sobre
  // blanco. Esto da consistencia y mejora el rendimiento de Vibrant.
  const processed = await sharp(imageBuffer)
    .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer()

  const palette = await Vibrant.from(processed).getPalette()

  const swatches = Object.values(palette).filter((s) => s !== null) as any[]

  // Convertir a nuestro formato
  const all: ExtractedColor[] = swatches.map((s) => {
    const [r, g, b] = s.rgb
    const [, sat] = rgbToHsl(r, g, b)
    return {
      hex: toHex(r, g, b),
      luminance: relLuminance(r, g, b),
      saturation: sat,
      population: s.population,
    }
  })

  // Filtrar: descartar casi blancos (luminance > 0.94) y casi negros con saturación cero
  // (suelen ser sombras del logo, no colores de marca).
  const candidates = all.filter((c) => c.luminance < 0.94 && (c.saturation > 0.05 || c.luminance < 0.2))

  // Ordenar candidatos: primero por saturación (más vivo gana) ponderado por población
  const ranked = [...candidates].sort(
    (a, b) => b.saturation * 0.7 + b.population * 0.3 - (a.saturation * 0.7 + a.population * 0.3),
  )

  const primary = ranked[0]?.hex || '#7a4f23'

  // Acento: el segundo color más saturado que sea distinto del principal
  // (diferencia perceptual mínima en hue o luminancia).
  let accent = primary
  for (let i = 1; i < ranked.length; i++) {
    const c = ranked[i]
    const [r1, g1, b1] = rgbFromHex(primary)
    const [r2, g2, b2] = rgbFromHex(c.hex)
    const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)
    if (diff > 80) {
      accent = c.hex
      break
    }
  }
  if (accent === primary) accent = shiftLightness(primary, 0.18)

  // Background: claro neutral con tinte cálido del principal (5% de tinte)
  const [pr, pg, pb] = rgbFromHex(primary)
  const background = toHex(
    248 + (pr - 248) * 0.04,
    245 + (pg - 245) * 0.04,
    240 + (pb - 240) * 0.04,
  )

  // Surface: fondo + un pelín más oscuro
  const surface = shiftLightness(background, -0.03)

  // Text: usar la versión más oscura del primary si tiene saturación; si no, charcoal.
  const text =
    ranked[0] && ranked[0].saturation > 0.15
      ? shiftLightness(primary, -0.55)
      : '#1f1b17'

  return {
    primary,
    accent,
    background,
    text,
    surface,
    all,
  }
}
