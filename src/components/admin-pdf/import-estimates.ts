/**
 * Estimaciones orientativas para el asistente de importación.
 *
 * Derivadas de ejecuciones reales con Gemini 2.5 Flash (junio-julio 2026):
 * ~1 céntimo y ~15 segundos por página de catálogo. Son para orientar al
 * cliente antes de lanzar, no una tarifa exacta.
 */
export const COST_PER_PAGE_USD = 0.008
export const SECONDS_PER_PAGE = 15

export function formatCost(usd: number): string {
  return `${usd.toFixed(2).replace('.', ',')} $`
}

export function formatDuration(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`
}
