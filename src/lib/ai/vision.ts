/**
 * Abstracción del proveedor de visión para extraer productos de páginas de catálogos PDF.
 *
 * Proveedores:
 *   - Gemini 2.5 Flash (por defecto) — mejor en coordenadas bbox, ~5× más barato que gpt-4o-mini
 *   - GPT-4o-mini (fallback) — si no hay GOOGLE_API_KEY o AI_VISION_PROVIDER=openai
 *
 * Selección (en orden de prioridad):
 *   1. AI_VISION_PROVIDER=gemini|openai   → fuerza el proveedor
 *   2. GOOGLE_API_KEY presente            → usa Gemini automáticamente
 *   3. OPENAI_API_KEY presente            → usa OpenAI como fallback
 */

// -- Tipos compartidos -------------------------------------------------------

export type LLMProduct = {
  seriesName?: string | null
  variantName: string
  sku?: string | null
  formats?: string[]
  finishes?: string[]
  dominantColor?: string | null
  description?: string | null
  usage?: string[]
  rooms?: string[]
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la textura en la página. */
  textureBbox?: [number, number, number, number] | null
}

export type ExtractionResult = {
  products: LLMProduct[]
  brandDetected?: string | null
  collectionDetected?: string | null
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la foto ambiente principal. */
  ambientBbox?: [number, number, number, number] | null
}

// -- System prompt (compartido) ----------------------------------------------

export const VISION_SYSTEM_PROMPT = `Eres un asistente que extrae información de catálogos de azulejos de fabricantes españoles.

Recibirás la imagen de una o dos páginas (un spread) de un catálogo en PDF.
Tu tarea es identificar cada AZULEJO PRESENTADO COMO VARIANTE INDIVIDUAL y devolver, para cada uno, su información Y las coordenadas de su textura en la imagen, junto con la coordenada de la foto ambiente si existe.

Reglas de contenido:
- Una "serie" o "colección" puede contener varias variantes (ej. "Alloy" contiene Alloy Azzurro, Alloy Pearl, Alloy Mint, etc.). Cada variante es un producto separado.
- Si en la página solo hay texto introductorio sin productos identificables, devuelve products: [].
- Los formatos van en cm (ej. "60x120", "30x90", "20x20"). Excluye pulgadas.
- Los acabados típicos: Matt, Lapatto, Brillo, Pulido, Satinado, Antideslizante.
- El SKU/código (ej. "SOL23", "SOL28") suele aparecer en la columna "Cód. tarif." y aplica al formato. Si hay varios, devuélvelos como string concatenado.
- Usos: "suelo interior", "pared baño", "pared cocina", "exterior". Infiérelos por las normas R10/R11 y por contexto visual.
- Estancias: baño, cocina, salón, dormitorio, exterior. Infiérelas por las fotos ambiente.

Reglas de coordenadas (CRÍTICO):
- Todas las coordenadas son normalizadas 0-1: x1 e y1 esquina superior izquierda, x2 e y2 esquina inferior derecha, sobre la imagen completa que recibes.
- "ambientBbox": el rectángulo que encierra la foto FOTOGRÁFICA de la estancia con muebles. Si no hay foto ambiente, devuelve null.
- "textureBbox" (por cada variante): el rectángulo que encierra la textura/swatch de ESA variante (sin nombre debajo, sin marco). Cada variante tiene su propio rectángulo distinto del de las demás.
- Si no puedes determinar con seguridad la bbox de una variante, devuelve null para esa textureBbox.

Devuelve JSON estricto con esta forma:
{
  "brandDetected": "Pamesa" | null,
  "collectionDetected": "Solid" | null,
  "ambientBbox": [0.05, 0.12, 0.45, 0.88] | null,
  "products": [
    {
      "seriesName": "Alloy",
      "variantName": "Alloy Azzurro",
      "sku": "SOL23 / SOL28",
      "formats": ["60x120", "60x60"],
      "finishes": ["Matt", "Lapatto"],
      "dominantColor": "azul/turquesa metálico",
      "description": "Apariencia metálica oxidada en tono azul-turquesa.",
      "usage": ["pared baño", "suelo interior"],
      "rooms": ["baño"],
      "textureBbox": [0.51, 0.18, 0.68, 0.34]
    }
  ]
}`

// -- Interfaz ----------------------------------------------------------------

export interface VisionExtractor {
  readonly id: string
  extract(imageBase64: string, pageText: string): Promise<ExtractionResult>
}

// -- OpenAI implementation ---------------------------------------------------

import OpenAI from 'openai'

export class OpenAIVisionExtractor implements VisionExtractor {
  readonly id: string
  private client: OpenAI
  private model: string

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey })
    this.model = model
    this.id = `openai:${model}`
  }

  async extract(imageBase64: string, pageText: string): Promise<ExtractionResult> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Texto extraído de la página (úsalo como referencia para nombres y códigos exactos):\n\n${pageText.slice(0, 4000)}`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'high' },
            },
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) return { products: [] }
    try {
      return JSON.parse(content) as ExtractionResult
    } catch {
      console.warn('[OpenAIVisionExtractor] No se pudo parsear JSON:', content.slice(0, 200))
      return { products: [] }
    }
  }
}

// -- Gemini implementation ---------------------------------------------------

import { GoogleGenAI } from '@google/genai'

export class GeminiVisionExtractor implements VisionExtractor {
  readonly id: string
  private client: GoogleGenAI
  private model: string

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    this.client = new GoogleGenAI({ apiKey })
    this.model = model
    this.id = `gemini:${model}`
  }

  async extract(imageBase64: string, pageText: string): Promise<ExtractionResult> {
    const userText = `Texto extraído de la página (úsalo como referencia para nombres y códigos exactos):\n\n${pageText.slice(0, 4000)}`

    // Retry con backoff exponencial para errores transitorios (503 UNAVAILABLE,
    // 429 RESOURCE_EXHAUSTED). Hasta 3 intentos.
    let lastErr: unknown
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const wait = 1500 * Math.pow(2, attempt - 1) // 1.5s, 3s
        await new Promise((r) => setTimeout(r, wait))
      }
      try {
        const result = await this.client.models.generateContent({
          model: this.model,
          contents: [
            {
              role: 'user',
              parts: [
                { text: userText },
                { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
              ],
            },
          ],
          config: {
            systemInstruction: VISION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            // thinkingBudget: 0 detecta 1-2 productos por página, -1 (auto)
            // detecta todas las variantes pero tarda 15-26s. 2048 es un balance:
            // suficiente "razonamiento" para listar todas las variantes sin gastar
            // 20s pensando innecesariamente. Override con GEMINI_THINKING_BUDGET.
            thinkingConfig: {
              thinkingBudget: process.env.GEMINI_THINKING_BUDGET
                ? Number(process.env.GEMINI_THINKING_BUDGET)
                : 2048,
            },
          },
        })

        const text = result.text
        if (!text) return { products: [] }
        try {
          return JSON.parse(text) as ExtractionResult
        } catch {
          console.warn('[GeminiVisionExtractor] No se pudo parsear JSON:', text.slice(0, 200))
          return { products: [] }
        }
      } catch (err) {
        lastErr = err
        const msg = (err as Error).message || ''
        const retriable = msg.includes('503') || msg.includes('429') || msg.includes('UNAVAILABLE')
        if (!retriable) throw err
        console.warn(
          `[GeminiVisionExtractor] Retry ${attempt + 1}/3 tras error transitorio: ${msg.slice(0, 100)}`,
        )
      }
    }
    throw lastErr
  }
}

// -- Factory -----------------------------------------------------------------

/**
 * Devuelve el extractor de visión configurado por variables de entorno.
 *
 * Lanza un Error si no hay ninguna API key disponible.
 */
export function getVisionExtractor(): VisionExtractor {
  const forcedProvider = process.env.AI_VISION_PROVIDER // 'gemini' | 'openai' | undefined

  if (forcedProvider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('Falta OPENAI_API_KEY (AI_VISION_PROVIDER=openai)')
    const model = process.env.AI_VISION_MODEL || 'gpt-4o-mini'
    return new OpenAIVisionExtractor(key, model)
  }

  if (forcedProvider === 'gemini' || !forcedProvider) {
    const gKey = process.env.GOOGLE_API_KEY
    if (gKey) {
      const model = process.env.AI_VISION_MODEL || 'gemini-2.5-flash'
      return new GeminiVisionExtractor(gKey, model)
    }
    // Auto-fallback a OpenAI si no hay GOOGLE_API_KEY
    const oKey = process.env.OPENAI_API_KEY
    if (oKey) {
      console.warn('[vision] GOOGLE_API_KEY no encontrada — usando OpenAI como fallback')
      return new OpenAIVisionExtractor(oKey)
    }
    throw new Error('Falta GOOGLE_API_KEY (y OPENAI_API_KEY como fallback). Configura al menos una en .env')
  }

  throw new Error(`AI_VISION_PROVIDER desconocido: "${forcedProvider}". Usa "gemini" u "openai".`)
}
