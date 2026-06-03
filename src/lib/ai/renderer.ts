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

// -- Gemini Image provider ---------------------------------------------------

import { GoogleGenAI } from '@google/genai'

type GeminiProviderConfig = {
  apiKey: string
  /** Modelo de generación de imagen. Por defecto: gemini-2.5-flash-image */
  model?: string
  /** Coste estimado en centavos por imagen generada. */
  costPerImageCents?: number
}

export class GeminiImageProvider implements RenderingProvider {
  readonly id: string
  private client: GoogleGenAI
  private model: string
  private costPerImageCents: number

  constructor(cfg: GeminiProviderConfig) {
    this.client = new GoogleGenAI({ apiKey: cfg.apiKey })
    this.model = cfg.model || 'gemini-2.5-flash-image'
    this.id = `gemini:${this.model}`
    this.costPerImageCents = cfg.costPerImageCents ?? 4
  }

  async generate(req: RenderRequest): Promise<RenderResult> {
    const prompt = buildPrompt(req)
    const started = Date.now()

    // Imagen base + texturas de azulejos como partes inline
    const parts: any[] = [
      { text: prompt },
      {
        inlineData: {
          mimeType: req.baseImageMimeType || 'image/jpeg',
          data: req.baseImage.toString('base64'),
        },
      },
      ...req.placements.map((p) => ({
        inlineData: {
          mimeType: 'image/jpeg',
          data: p.textureImage.toString('base64'),
        },
      })),
    ]

    const result = await this.client.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    })

    const candidates = result.candidates ?? []
    console.log(`[Gemini] candidates=${candidates.length}, parts=${candidates[0]?.content?.parts?.length ?? 0}`)
    if (candidates[0]?.content?.parts) {
      for (const p of candidates[0].content.parts as any[]) {
        console.log(`[Gemini] part: text=${!!p.text} inlineData=${!!p.inlineData} mime=${p.inlineData?.mimeType}`)
      }
    }

    const imagePart = candidates[0]?.content?.parts?.find(
      (p: any) => p.inlineData?.mimeType?.startsWith('image/'),
    )
    if (!imagePart?.inlineData?.data) {
      throw new Error(`Gemini no devolvió imagen en la respuesta (candidates=${candidates.length})`)
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    const mimeType: string = imagePart.inlineData.mimeType || 'image/png'

    return {
      imageBuffer,
      mimeType,
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

/**
 * Devuelve el proveedor de renderizado según las variables de entorno.
 *
 * Selección (en orden de prioridad):
 *   1. AI_PROVIDER=gemini|openai|mock → fuerza el proveedor
 *   2. GOOGLE_API_KEY presente        → usa Gemini automáticamente (~4× más barato, ~6× más rápido)
 *   3. OPENAI_API_KEY presente        → usa OpenAI gpt-image-1
 *   4. Sin keys                       → MockProvider (desarrollo)
 */
export function getRenderingProvider(): RenderingProvider {
  const forcedProvider = process.env.AI_PROVIDER // 'gemini' | 'openai' | 'mock' | undefined

  if (forcedProvider === 'mock') return new MockProvider()

  if (forcedProvider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('Falta OPENAI_API_KEY (AI_PROVIDER=openai)')
    return new OpenAIImageProvider({ apiKey: key })
  }

  if (forcedProvider === 'gemini') {
    const key = process.env.GOOGLE_API_KEY
    if (!key) throw new Error('Falta GOOGLE_API_KEY (AI_PROVIDER=gemini)')
    return new GeminiImageProvider({ apiKey: key })
  }

  // Auto-detect: Gemini primero (más rápido y barato), luego OpenAI, luego Mock
  const gKey = process.env.GOOGLE_API_KEY
  if (gKey && gKey.length > 10) return new GeminiImageProvider({ apiKey: gKey })

  const oKey = process.env.OPENAI_API_KEY
  if (oKey && oKey.length > 10) return new OpenAIImageProvider({ apiKey: oKey })

  return new MockProvider()
}
