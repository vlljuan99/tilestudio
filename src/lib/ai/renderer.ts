/**
 * Capa de abstracción del proveedor de IA para generar simulaciones.
 *
 * Hoy: OpenAI gpt-image-1 (sin máscara, instruido solo por prompt).
 * Mañana: se puede añadir SAM2 + FLUX Kontext / Gemini sin tocar el resto del producto.
 *
 * La interfaz acepta múltiples "placements" (azulejo+superficie) y "globalEdits"
 * (cambio de color de pared) pensando ya en la extensión futura a muebles/mamparas.
 */

export type Surface = 'floor' | 'wall'

export type TilePlacement = {
  tileName: string
  tileSku?: string | null
  surface: Surface
  /** Hex color dominante del azulejo, ayuda al modelo cuando la textura no es ideal. */
  dominantColorHex?: string | null
  /** Formato aproximado: ej. "60x60 cm" — guía al modelo sobre escala y grout. */
  formatLabel?: string | null
  /** Buffer de la imagen de textura del azulejo (referencia visual). */
  textureImage: Buffer
}

export type GlobalEdits = {
  wallColorHex?: string | null
}

export type RenderRequest = {
  baseImage: Buffer
  baseImageMimeType?: string
  placements: TilePlacement[]
  globalEdits?: GlobalEdits
}

export type RenderResult = {
  imageBuffer: Buffer
  mimeType: string
  provider: string
  promptUsed: string
  costCents: number
  latencyMs: number
}

export interface RenderingProvider {
  generate(req: RenderRequest): Promise<RenderResult>
  readonly id: string
}

// -- Prompt builder ----------------------------------------------------------

const SURFACE_ES: Record<Surface, string> = {
  floor: 'el suelo (toda la superficie del piso)',
  wall: 'las paredes (toda la superficie vertical, excluyendo techos, muebles, ventanas y puertas)',
}

export function buildPrompt(req: RenderRequest): string {
  const lines: string[] = []

  lines.push(
    'Edita fotorrealisticamente esta imagen de interior aplicando los siguientes cambios:',
  )

  for (const p of req.placements) {
    const parts: string[] = []
    parts.push(`- Cubre ${SURFACE_ES[p.surface]} con el azulejo "${p.tileName}"`)
    if (p.formatLabel) parts.push(`(formato ${p.formatLabel})`)
    if (p.dominantColorHex) parts.push(`(tono dominante ${p.dominantColorHex})`)
    lines.push(parts.join(' ') + '.')
  }

  if (req.globalEdits?.wallColorHex) {
    lines.push(
      `- Pinta cualquier zona de pared que NO esté cubierta por azulejos con el color ${req.globalEdits.wallColorHex} de forma uniforme.`,
    )
  }

  lines.push('')
  lines.push('REGLAS OBLIGATORIAS:')
  lines.push('- Mantén la geometría original, la perspectiva y los muebles intactos.')
  lines.push('- Respeta las sombras, los reflejos y la iluminación natural de la foto original.')
  lines.push('- Las juntas (lechada) deben ser realistas y consistentes con el formato del azulejo.')
  lines.push('- No añadas objetos nuevos ni cambies la disposición de los muebles.')
  lines.push('- El resultado debe parecer una foto real, no un render 3D.')

  return lines.join('\n')
}

// -- OpenAI provider ---------------------------------------------------------

import OpenAI from 'openai'

type OpenAIProviderConfig = {
  apiKey: string
  model?: string
  /** Cost estimation in cents per generated image — ajustar según pricing actual. */
  costPerImageCents?: number
}

export class OpenAIImageProvider implements RenderingProvider {
  readonly id = 'openai:gpt-image-1'
  private client: OpenAI
  private model: string
  private costPerImageCents: number

  constructor(cfg: OpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: cfg.apiKey })
    this.model = cfg.model || 'gpt-image-1'
    this.costPerImageCents = cfg.costPerImageCents ?? 17
  }

  async generate(req: RenderRequest): Promise<RenderResult> {
    const prompt = buildPrompt(req)
    const started = Date.now()

    // OpenAI image edit acepta image (1 o varias) + prompt.
    // Usamos la foto del usuario como "image" principal. Las texturas de azulejo
    // se referencian en el prompt (gpt-image-1 acepta varias imágenes como input).
    const userImageFile = await OpenAI.toFile(
      req.baseImage,
      'user-room.jpg',
      { type: req.baseImageMimeType || 'image/jpeg' },
    )

    const textureFiles = await Promise.all(
      req.placements.map((p, idx) =>
        OpenAI.toFile(p.textureImage, `tile-${idx}.jpg`, { type: 'image/jpeg' }),
      ),
    )

    const response = await this.client.images.edit({
      model: this.model,
      image: [userImageFile, ...textureFiles],
      prompt,
      size: '1536x1024',
      // n: 1 (default)
    })

    const b64 = response.data?.[0]?.b64_json
    if (!b64) {
      throw new Error('OpenAI no devolvió imagen (b64_json vacío)')
    }
    const imageBuffer = Buffer.from(b64, 'base64')

    return {
      imageBuffer,
      mimeType: 'image/png',
      provider: this.id,
      promptUsed: prompt,
      costCents: this.costPerImageCents,
      latencyMs: Date.now() - started,
    }
  }
}

// -- Mock provider (para desarrollo sin API key) -----------------------------

import sharp from 'sharp'

/** Provider falso que devuelve la imagen original con un watermark de texto.
 *  Útil para iterar UI/flow sin gastar tokens. */
export class MockProvider implements RenderingProvider {
  readonly id = 'mock:passthrough'

  async generate(req: RenderRequest): Promise<RenderResult> {
    const prompt = buildPrompt(req)
    const started = Date.now()

    const meta = await sharp(req.baseImage).metadata()
    const w = meta.width || 1200
    const h = meta.height || 800

    const overlaySvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect x="0" y="0" width="${w}" height="60" fill="rgba(0,0,0,0.6)"/>
        <text x="20" y="40" font-family="Arial, sans-serif" font-size="24" fill="white">
          MOCK · Simulación (sin OpenAI API key) · ${req.placements.length} azulejo(s)
        </text>
        <rect x="0" y="${h - 60}" width="${w}" height="60" fill="rgba(0,0,0,0.6)"/>
        <text x="20" y="${h - 22}" font-family="Arial, sans-serif" font-size="18" fill="white">
          ${req.placements.map((p) => `${p.surface}: ${p.tileName}`).join(' · ')}
        </text>
      </svg>
    `

    const imageBuffer = await sharp(req.baseImage)
      .composite([{ input: Buffer.from(overlaySvg) }])
      .jpeg({ quality: 85 })
      .toBuffer()

    return {
      imageBuffer,
      mimeType: 'image/jpeg',
      provider: this.id,
      promptUsed: prompt,
      costCents: 0,
      latencyMs: Date.now() - started,
    }
  }
}

// -- Factory ----------------------------------------------------------------

export function getRenderingProvider(): RenderingProvider {
  const key = process.env.OPENAI_API_KEY
  if (key && key.length > 10) {
    return new OpenAIImageProvider({ apiKey: key })
  }
  return new MockProvider()
}
