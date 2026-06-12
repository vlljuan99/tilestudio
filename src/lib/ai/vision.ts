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
  /** Código de color normalizado si aparece impreso (RAL / NCS / Pantone). */
  colorCode?: string | null
  formats?: string[]
  finishes?: string[]
  dominantColor?: string | null
  description?: string | null
  usage?: string[]
  rooms?: string[]
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la textura en la página. */
  textureBbox?: [number, number, number, number] | null
}

export type PageType =
  | 'cover'
  | 'index'
  | 'intro'
  | 'palette'
  | 'texture'
  | 'technical'
  | 'ambient'
  | 'graphic-variation'
  | 'special-pieces'
  | 'other'

export type ExtractionResult = {
  products: LLMProduct[]
  brandDetected?: string | null
  collectionDetected?: string | null
  /** Tipo de página detectado (ayuda al worker a decidir qué hacer con ella). */
  pageType?: PageType | null
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la foto ambiente principal. */
  ambientBbox?: [number, number, number, number] | null
  /**
   * Nombres de producto visibles en la foto ambiente (callouts tipo
   * "CŌRE MIX TAUPE 120X280"), sin el formato. Permite enlazar el ambiente
   * con variantes que se extraen en otras páginas.
   */
  ambientProducts?: string[]
}

// -- System prompt (compartido) ----------------------------------------------

export const VISION_SYSTEM_PROMPT = `Eres un asistente que extrae información de catálogos de azulejos de fabricantes españoles.

Recibirás la imagen de una o dos páginas (un spread) de un catálogo en PDF, junto con el texto extraído de la página.
Tu tarea: (1) clasificar el tipo de página, (2) identificar cada AZULEJO PRESENTADO COMO VARIANTE INDIVIDUAL con su información y la coordenada de su textura, (3) localizar la foto ambiente si existe.

TIPOS DE PÁGINA ("pageType"):
- "cover": portada del catálogo. products: [].
- "index": índice / sumario. products: [].
- "intro": presentación de la colección o de una serie (texto editorial, foto de inspiración). products: []. Si hay una foto de estancia real con azulejo aplicado, da su ambientBbox.
- "palette": muestrario de colores de una serie — varios swatches rectangulares con nombre de color (y a menudo códigos RAL/NCS). Extrae TODOS los colores del muestrario como productos, uno por swatch (si hay 8 swatches, products tiene 8 elementos), cada uno con su colorCode y su textureBbox.
- "texture": una o dos texturas a tamaño completo (media página o página entera cada una) con el nombre de la variante sobreimpreso (ej. "cōre ivory"). CADA textura ES una variante; su textureBbox es la mitad/zona que ocupa. NO es foto ambiente.
- "technical": fichas con tablas de datos (formatos, códigos, embalaje, normas). Cada variante con su swatch y tablas es un producto.
- "ambient": foto(s) de estancia decorada con el azulejo aplicado, a veces con callouts del producto.
- "graphic-variation": muestra la variación gráfica/tonal entre piezas de UNA MISMA variante (la misma textura repetida). products: [] — NO son variantes distintas.
- "special-pieces": piezas especiales (peldaños, rodapiés, mosaicos decorativos, "consulta disponibilidad"). products: [].
- "other": contraportada, limpieza, certificaciones, contacto… products: [].

REGLAS DE VERACIDAD (CRÍTICO — prohibido inventar):
- "sku": SOLO códigos de tarifa/producto impresos en la página (ej. "SOL23", "TECH04", "XXL06"). Los números de página NO son SKU. Los códigos RAL/NCS/Pantone NO son SKU (van en "colorCode"). Si no hay código impreso, sku: null. Si hay varios códigos para la variante (uno por formato/acabado), concaténalos: "TECH01 / TECH02 / TECH09".
- "formats": SOLO formatos impresos PARA ESA variante (en su tabla o etiqueta). En cm, formato "120x280". Excluye pulgadas (48"x110"). Si la página no imprime formatos para la variante (ej. página de paleta o textura), formats: [].
- "finishes": solo acabados que aparezcan (Matt, Lapatto, Brillo, Pulido, Satinado, Antideslizante…). En tablas técnicas, las columnas de acabado (ej. MATT, DUP, EXT) son los acabados disponibles: inclúyelas tal cual.
- "colorCode": código de color impreso junto al swatch (ej. "RAL 1013 / NCS S 1010-Y20R"), si no hay, null.
- "variantName": nombre COMPLETO del producto = serie + color (ej. "Cōre Pro Ivory"), aunque la página solo rotule "IVORY". Así la misma variante se llama igual en todas las páginas. "seriesName" = la serie (ej. "Cōre Pro").
- "collectionDetected": el nombre del catálogo/colección global (suele estar en portada o cabeceras), NO la serie de la página.
- "brandDetected": la marca/fabricante si aparece (logo o texto).
- Usos ("usage"): "suelo interior", "pared baño", "pared cocina", "exterior". Infiérelos por las normas de resbaladicidad (R10/R11, Clase 3) y contexto. Estancias ("rooms"): baño, cocina, salón, dormitorio, exterior — solo si hay fotos ambiente o el texto lo indica.
- Usa el TEXTO extraído como fuente autoritativa para nombres y códigos exactos; la imagen, para posiciones y para lo que el texto no recoja.

REGLAS DE COORDENADAS (CRÍTICO):
- Coordenadas normalizadas 0-1 sobre la imagen completa: x1,y1 esquina superior izquierda; x2,y2 inferior derecha.
- "ambientBbox": SOLO una fotografía de ESTANCIA REAL (espacio con perspectiva: suelo/pared, muebles, plantas, luz natural). Un primer plano de la textura NO es ambiente. Si no hay, null.
- "ambientProducts": si la foto ambiente tiene callouts o etiquetas con nombres de producto (ej. "CŌRE MIX TAUPE 120X280"), lista los nombres SIN el formato: ["Cōre Mix Taupe"]. Si no hay callouts, [].
- Un producto que SOLO aparece como callout de la foto ambiente va en "ambientProducts", NUNCA en "products" (no tiene swatch propio en esta página; su ficha saldrá en otra).
- "textureBbox" (por variante): rectángulo de la textura/swatch de ESA variante (sin el rótulo, sin marco). Cada variante tiene un rectángulo distinto. En páginas "texture", la mitad/zona completa que ocupa esa textura. Si no la localizas con seguridad, null.

Devuelve JSON estricto con esta forma:
{
  "pageType": "technical",
  "brandDetected": "Pamesa" | null,
  "collectionDetected": "Cōre Tech" | null,
  "ambientBbox": [0.05, 0.12, 0.45, 0.88] | null,
  "ambientProducts": ["Cōre Ivory"],
  "products": [
    {
      "seriesName": "Cōre",
      "variantName": "Cōre Ivory",
      "sku": "TECH01 / TECH02 / TECH09",
      "colorCode": "RAL 1013 / NCS S 1010-Y20R",
      "formats": ["120x120", "60x120", "60x60", "30x60"],
      "finishes": ["Matt", "Ext"],
      "dominantColor": "blanco marfil",
      "description": "Gres porcelánico inspirado en la piedra caliza.",
      "usage": ["suelo interior", "pared baño"],
      "rooms": ["salón"],
      "textureBbox": [0.04, 0.14, 0.22, 0.44]
    }
  ]
}`

// -- Interfaz ----------------------------------------------------------------

/** Consumo acumulado de un proveedor durante una extracción. */
export type UsageStats = {
  provider: string
  calls: number
  inputTokens: number
  outputTokens: number
  /** Estimación en USD según tarifas hardcodeadas (orientativo). */
  estimatedCostUsd: number
}

// Tarifas por millón de tokens (junio 2026, orientativas — revisar si cambian).
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  'gemini-2.5-flash': { input: 0.3, output: 2.5 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
}

function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING_PER_MTOK[model]
  if (!p) return 0
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

export interface VisionExtractor {
  readonly id: string
  extract(imageBase64: string, pageText: string): Promise<ExtractionResult>
  /** Consumo acumulado desde la creación del extractor (uno por proveedor). */
  getUsage(): UsageStats[]
}

// -- Retry helper --------------------------------------------------------------

/**
 * Reintenta `fn` ante errores transitorios de API (429/431/5xx/UNAVAILABLE).
 * Backoff exponencial: 2s, 6s, 18s. `attempts` configurable: cuando hay un
 * proveedor de respaldo, el primario reintenta menos (2) y cede antes.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const wait = 2000 * Math.pow(3, attempt - 1)
      await new Promise((r) => setTimeout(r, wait))
    }
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = (err as Error).message || ''
      const status = (err as any)?.status as number | undefined
      const retriable =
        (typeof status === 'number' && (status === 429 || status === 431 || status >= 500)) ||
        /\b(429|431|5\d\d)\b/.test(msg) ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('ECONNRESET') ||
        msg.includes('fetch failed') ||
        /tim(ed)?\s?out|abort/i.test(msg)
      if (!retriable) throw err
      console.warn(
        `[${label}] Retry ${attempt + 1}/${attempts} tras error transitorio: ${msg.slice(0, 120)}`,
      )
    }
  }
  throw lastErr
}

// -- Fallback entre proveedores ------------------------------------------------

/**
 * Si el proveedor primario agota sus reintentos (p.ej. Gemini en pico de
 * "high demand"), prueba con el secundario en vez de perder la página.
 */
export class FallbackVisionExtractor implements VisionExtractor {
  readonly id: string
  constructor(
    private primary: VisionExtractor,
    private fallback: VisionExtractor,
  ) {
    this.id = `${primary.id} (fallback: ${fallback.id})`
  }

  getUsage(): UsageStats[] {
    // Solo proveedores que realmente se usaron.
    return [...this.primary.getUsage(), ...this.fallback.getUsage()].filter((u) => u.calls > 0)
  }

  async extract(imageBase64: string, pageText: string): Promise<ExtractionResult> {
    try {
      return await this.primary.extract(imageBase64, pageText)
    } catch (err) {
      console.warn(
        `[FallbackVisionExtractor] ${this.primary.id} falló (${(err as Error).message?.slice(0, 100)}) — probando ${this.fallback.id}`,
      )
      return this.fallback.extract(imageBase64, pageText)
    }
  }
}

// -- OpenAI implementation ---------------------------------------------------

import OpenAI from 'openai'

export class OpenAIVisionExtractor implements VisionExtractor {
  readonly id: string
  private client: OpenAI
  private model: string
  private attempts: number
  private calls = 0
  private inputTokens = 0
  private outputTokens = 0

  constructor(apiKey: string, model = 'gpt-4o-mini', attempts = 4) {
    // timeout duro: una request colgada no puede parar el worker entero.
    // maxRetries 0 — los reintentos los gestiona withRetry.
    this.client = new OpenAI({ apiKey, timeout: 90_000, maxRetries: 0 })
    this.model = model
    this.attempts = attempts
    this.id = `openai:${model}`
  }

  getUsage(): UsageStats[] {
    return [
      {
        provider: this.id,
        calls: this.calls,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        estimatedCostUsd: estimateCostUsd(this.model, this.inputTokens, this.outputTokens),
      },
    ]
  }

  async extract(imageBase64: string, pageText: string): Promise<ExtractionResult> {
    const response = await withRetry('OpenAIVisionExtractor', () =>
      this.client.chat.completions.create({
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
      }),
      this.attempts,
    )

    this.calls++
    this.inputTokens += response.usage?.prompt_tokens || 0
    this.outputTokens += response.usage?.completion_tokens || 0

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
  private attempts: number
  private calls = 0
  private inputTokens = 0
  private outputTokens = 0

  constructor(apiKey: string, model = 'gemini-2.5-flash', attempts = 4) {
    // timeout duro: sin él, una conexión estancada tras un pico de 503s deja
    // el worker colgado para siempre en mitad de una página.
    this.client = new GoogleGenAI({ apiKey, httpOptions: { timeout: 90_000 } })
    this.model = model
    this.attempts = attempts
    this.id = `gemini:${model}`
  }

  getUsage(): UsageStats[] {
    return [
      {
        provider: this.id,
        calls: this.calls,
        inputTokens: this.inputTokens,
        outputTokens: this.outputTokens,
        estimatedCostUsd: estimateCostUsd(this.model, this.inputTokens, this.outputTokens),
      },
    ]
  }

  async extract(imageBase64: string, pageText: string): Promise<ExtractionResult> {
    const userText = `Texto extraído de la página (úsalo como referencia para nombres y códigos exactos):\n\n${pageText.slice(0, 4000)}`

    const result = await withRetry('GeminiVisionExtractor', () =>
      this.client.models.generateContent({
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
      }),
      this.attempts,
    )

    this.calls++
    const meta = result.usageMetadata
    this.inputTokens += meta?.promptTokenCount || 0
    // El "thinking" se factura como salida.
    this.outputTokens += (meta?.candidatesTokenCount || 0) + (meta?.thoughtsTokenCount || 0)

    const text = result.text
    if (!text) return { products: [] }
    try {
      return JSON.parse(text) as ExtractionResult
    } catch {
      console.warn('[GeminiVisionExtractor] No se pudo parsear JSON:', text.slice(0, 200))
      return { products: [] }
    }
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
  const gKey = process.env.GOOGLE_API_KEY
  const oKey = process.env.OPENAI_API_KEY

  // Si hay las dos keys, el secundario actúa de respaldo cuando el primario
  // agota reintentos (picos 503 de Gemini, etc). Desactivable con
  // AI_VISION_FALLBACK=off.
  const fallbackEnabled = process.env.AI_VISION_FALLBACK !== 'off'

  if (forcedProvider === 'openai') {
    if (!oKey) throw new Error('Falta OPENAI_API_KEY (AI_VISION_PROVIDER=openai)')
    if (fallbackEnabled && gKey) {
      // Con respaldo disponible, el primario cede tras 2 intentos.
      const primary = new OpenAIVisionExtractor(oKey, process.env.AI_VISION_MODEL || 'gpt-4o-mini', 2)
      return new FallbackVisionExtractor(primary, new GeminiVisionExtractor(gKey))
    }
    return new OpenAIVisionExtractor(oKey, process.env.AI_VISION_MODEL || 'gpt-4o-mini')
  }

  if (forcedProvider === 'gemini' || !forcedProvider) {
    if (gKey) {
      const model = process.env.AI_VISION_MODEL || 'gemini-2.5-flash'
      if (fallbackEnabled && oKey) {
        // Con respaldo disponible, el primario cede tras 2 intentos.
        const primary = new GeminiVisionExtractor(gKey, model, 2)
        return new FallbackVisionExtractor(primary, new OpenAIVisionExtractor(oKey))
      }
      return new GeminiVisionExtractor(gKey, model)
    }
    // Auto-fallback a OpenAI si no hay GOOGLE_API_KEY
    if (oKey) {
      console.warn('[vision] GOOGLE_API_KEY no encontrada — usando OpenAI como fallback')
      return new OpenAIVisionExtractor(oKey)
    }
    throw new Error('Falta GOOGLE_API_KEY (y OPENAI_API_KEY como fallback). Configura al menos una en .env')
  }

  throw new Error(`AI_VISION_PROVIDER desconocido: "${forcedProvider}". Usa "gemini" u "openai".`)
}
