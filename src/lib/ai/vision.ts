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

/** Una foto de estancia real (entorno) presente en la página. */
export type AmbientRegion = {
  /** Bounding box [x1,y1,x2,y2] normalizado 0-1 de la foto. */
  bbox: [number, number, number, number]
  /**
   * Nombres de producto visibles como callouts en la foto (ej. "Cōre Mix Taupe"),
   * SIN el formato. Permite enlazar el entorno con variantes de otras páginas.
   */
  products?: string[]
  /** Superficies donde se aplica el azulejo en la foto: "floor" | "wall" | "other". */
  surfaces?: string[]
}

/**
 * Datos a nivel de SERIE cuando la página los presenta una sola vez para toda la
 * colección, sin repetirlos por color (típico de NewTiles: la ficha técnica lista
 * "Formatos: 20x120" para los 4 colores de la serie). El worker los propaga a
 * todas las variantes de la misma serie.
 */
export type SeriesInfo = {
  name?: string | null
  formats?: string[]
  finishes?: string[]
  /** Piezas especiales (peldaños, rodapiés, mosaicos…): ["Rodapié 8x60", "Hexágono mosaico 24x28"]. */
  specialPieces?: string[]
  description?: string | null
}

export type ExtractionResult = {
  products: LLMProduct[]
  brandDetected?: string | null
  collectionDetected?: string | null
  /** Tipo de página detectado (ayuda al worker a decidir qué hacer con ella). */
  pageType?: PageType | null
  /** TODAS las fotos de estancia real de la página (un spread puede tener 2+). */
  ambients?: AmbientRegion[]
  /** Datos comunes de la serie si la página los da sin desglosar por color. */
  series?: SeriesInfo | null

  // -- Compatibilidad con el prompt anterior (campos sueltos de un solo ambiente) --
  /** @deprecated usar `ambients`. */
  ambientBbox?: [number, number, number, number] | null
  /** @deprecated usar `ambients[].products`. */
  ambientProducts?: string[]
}

/**
 * Normaliza la salida del LLM a la forma canónica: convierte los campos antiguos
 * de ambiente único (`ambientBbox`/`ambientProducts`) al array `ambients`, y
 * garantiza que `products`/`ambients` existen.
 */
export function normalizeExtraction(raw: any): ExtractionResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as ExtractionResult
  const ambients: AmbientRegion[] = Array.isArray(r.ambients) ? r.ambients.filter((a) => Array.isArray(a?.bbox)) : []
  // Retrocompat: si vino el campo antiguo, lo añadimos como un ambiente más.
  if (ambients.length === 0 && Array.isArray(r.ambientBbox)) {
    ambients.push({ bbox: r.ambientBbox as any, products: r.ambientProducts || [] })
  }
  return {
    products: Array.isArray(r.products) ? r.products : [],
    brandDetected: r.brandDetected ?? null,
    collectionDetected: r.collectionDetected ?? null,
    pageType: r.pageType ?? null,
    ambients,
    series: r.series ?? null,
  }
}

// -- System prompt (compartido) ----------------------------------------------

export const VISION_SYSTEM_PROMPT = `Eres un asistente que extrae información de catálogos de azulejos de fabricantes españoles.

Recibirás la imagen de una o dos páginas (un spread) de un catálogo en PDF, junto con el texto extraído de la página.
Tu tarea: (1) clasificar el tipo de página, (2) identificar cada AZULEJO PRESENTADO COMO VARIANTE INDIVIDUAL con su información y la coordenada exacta de su textura/swatch, (3) localizar TODAS las fotos de estancia (entornos), (4) capturar los datos comunes de la serie si la página los da sin desglosar por color.

TIPOS DE PÁGINA ("pageType"):
- "cover": portada del catálogo. products: [].
- "index": índice / sumario / índice por formatos. products: [].
- "intro": presentación de la colección o de una serie (texto editorial, foto de inspiración). products: []. Si hay foto(s) de estancia real, dalas en "ambients".
- "palette": muestrario de colores de una serie — varios swatches rectangulares cada uno rotulado con su color (CEREZO, ROBLE, IVORY…) y a veces códigos RAL/NCS. Extrae TODOS los swatches como productos (si hay 8 swatches, products tiene 8 elementos), cada uno con su textureBbox preciso. Una página "hero" que combina una textura grande decorativa + una fila de swatches de color rotulados ES "palette": los productos son los swatches rotulados, NO la textura grande.
- "texture": una o dos texturas a tamaño completo (media página o página entera) con el nombre de la variante sobreimpreso (ej. "cōre ivory"). CADA textura rotulada ES una variante; su textureBbox es la zona que ocupa. NO es foto de estancia.
- "technical": fichas con tablas de datos (formatos, códigos, embalaje, normas, símbolos de acabado/resbaladicidad). Si lista cada color con su swatch, cada uno es un product. Si describe la serie EN CONJUNTO sin desglosar colores (ej. "COLECCIÓN ALBAR · 4 colores · Formatos: 20x120"), products: [] y rellena "series".
- "ambient": una o más fotos de estancia decorada con el azulejo aplicado, a menudo con callouts del producto. Dalas TODAS en "ambients".
- "graphic-variation": variación gráfica/tonal entre piezas de UNA MISMA variante (la misma textura repetida). products: [].
- "special-pieces": página dedicada a piezas especiales (peldaños, rodapiés, mosaicos, cubrecantos). products: [].
- "other": contraportada, limpieza, certificaciones, contacto, sostenibilidad… products: [].

REGLAS DE VERACIDAD (CRÍTICO — prohibido inventar):
- "variantName": nombre COMPLETO del producto = serie + color (ej. "Albar Cerezo", "Cōre Ivory"), aunque la página solo rotule el color ("CEREZO"). Usa el título de la serie visible en la página para componerlo. Así la misma variante se llama igual en todas sus páginas. "seriesName" = la serie (ej. "Albar", "Cōre Pro").
- "sku": SOLO códigos de tarifa/producto impresos (ej. "SOL23", "TECH04", "M85", "P180"). Los números de página NO son SKU. Los códigos RAL/NCS/Pantone NO son SKU (van en "colorCode"). El nombre del grupo o tramo de tarifa (ej. "GENERAL", "PRICE LIST B", "TARIFA 2") tampoco es un SKU. Si no hay, null. Si hay varios para la variante, concaténalos: "M85 / M90".
- "formats": SOLO formatos impresos PARA ESA variante. En cm: "120x280", "20x120", "9,3x120". Excluye pulgadas (48"x110"). Si la página no imprime formato para la variante (paleta sin formato), formats: [].
- "finishes": SOLO el acabado de superficie (Matt, Mate, Lapatto, Brillo, Pulido, Satinado, Natural, In/Out, Antideslizante). NO son acabados y NO debes incluir: resistencia al deslizamiento (R9, R10, R11, R12, R13), clases de uso (Clase/Class 1-5), PEI, ni absorción de agua — esos datos van implícitos en "usage", no aquí.
- "colorCode": código de color impreso junto al swatch (ej. "RAL 1013 / NCS S 1010-Y20R"), si no hay, null.
- "collectionDetected": SOLO el nombre del CATÁLOGO/libro global (ej. "Catálogo General 2026", "Cōre Tech"), normalmente en portada o pies de página. Un banner grande de serie como "ALBAR COLLECTION" o "NATURE COLLECTION" NO es la colección global: eso es la SERIE (va en seriesName/variantName). Si en la página solo se ve el banner de la serie y no el nombre del catálogo, deja collectionDetected en null.
- "brandDetected": la marca/fabricante si aparece (logo o texto).
- "usage": "suelo interior", "pared baño", "pared cocina", "exterior". Infiérelos por resbaladicidad (R10/R11, Clase 3) y contexto. "rooms": baño, cocina, salón, dormitorio, exterior — solo si hay foto de estancia o el texto lo indica.
- Usa el TEXTO extraído como fuente autoritativa para nombres y códigos exactos; la imagen, para posiciones y lo que el texto no recoja.

REGLAS DE COORDENADAS (CRÍTICO):
- Coordenadas normalizadas 0-1 sobre la imagen completa: x1,y1 esquina superior izquierda; x2,y2 inferior derecha.
- "textureBbox" (por variante): rectángulo CEÑIDO SOLO a la muestra cerámica de ESA variante. El rótulo de texto (nombre y formato) suele ir DEBAJO de la muestra: NO lo incluyas, ni los márgenes blancos. En una rejilla de muchos swatches, da el rectángulo EXACTO de cada celda de color (la zona coloreada que está encima de su rótulo), sin solaparte con las celdas vecinas. Sé preciso: una bbox holgada captura el texto o la celda de al lado. En páginas "texture", la zona completa de la textura. Si no la localizas con seguridad, null.

ENTORNOS — "ambients" (array, una entrada por foto de estancia):
- Incluye SOLO fotografías de ESTANCIA REAL con perspectiva tridimensional y MUEBLES, decoración o PERSONAS (salón, cocina, baño, dormitorio, terraza, local…). Un spread con 2 fotos de estancia da 2 entradas.
- NUNCA es entorno: una ficha técnica, una paleta, una cuadrícula de swatches, un primer plano de textura, una TEXTURA GRANDE A SANGRE de madera/piedra/cemento sin muebles, una imagen de producto sobre fondo blanco, una variación gráfica, o cualquier composición plana sin profundidad.
- "bbox": rectángulo de la foto. "products": nombres de los azulejos citados en callouts SIN el formato (ej. "WALL | ALBAR HAYA - 20x120" → ["Albar Haya"]). "surfaces": ["floor"], ["wall"] o ambas según indique el callout (FLOOR/SUELO → "floor", WALL/PARED → "wall").
- Un producto que SOLO aparece como callout de un entorno (sin swatch propio en esta página) va en ambients[].products, NUNCA en products.

DATOS DE SERIE — "series" (cuando la página describe la serie sin desglosar por color):
- "name": nombre de la serie. "formats"/"finishes": los que apliquen a toda la serie. "specialPieces": piezas especiales con su formato (ej. ["Rodapié 8x60", "Hexágono mosaico 24x28", "Peldaño 33x120"]). "description": texto editorial de la serie.
- Si la página YA lista los colores como products individuales, no dupliques: deja series en null.

Devuelve JSON estricto con esta forma:
{
  "pageType": "palette",
  "brandDetected": "NewTiles" | null,
  "collectionDetected": "..." | null,
  "ambients": [
    { "bbox": [0.05, 0.12, 0.45, 0.88], "products": ["Albar Haya"], "surfaces": ["floor", "wall"] }
  ],
  "series": { "name": "Albar", "formats": ["20x120"], "finishes": ["Matt", "Anti-slip"], "specialPieces": ["Rodapié 8x60", "Hexágono mosaico 24x28"], "description": "Inspirada en la madera natural." } | null,
  "products": [
    {
      "seriesName": "Albar",
      "variantName": "Albar Cerezo",
      "sku": "M85 / M90",
      "colorCode": null,
      "formats": ["20x120"],
      "finishes": ["Matt"],
      "dominantColor": "marrón cerezo",
      "description": null,
      "usage": ["suelo interior"],
      "rooms": [],
      "textureBbox": [0.06, 0.54, 0.38, 0.66]
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
    if (!content) return { products: [], ambients: [] }
    try {
      return normalizeExtraction(JSON.parse(content))
    } catch {
      console.warn('[OpenAIVisionExtractor] No se pudo parsear JSON:', content.slice(0, 200))
      return { products: [], ambients: [] }
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
    if (!text) return { products: [], ambients: [] }
    try {
      return normalizeExtraction(JSON.parse(text))
    } catch {
      console.warn('[GeminiVisionExtractor] No se pudo parsear JSON:', text.slice(0, 200))
      return { products: [], ambients: [] }
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
