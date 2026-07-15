/**
 * Tema visual del cliente (SiteSettings) como CSS variables.
 *
 * Extraído del layout público para que otras zonas con root layout propio
 * (la zona de ventas) compartan la misma paleta, fuentes y radios sin
 * duplicar la lógica de conversión.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

export async function getSiteSettings(): Promise<any | null> {
  const payload = await getPayload({ config })
  try {
    return await payload.findGlobal({ slug: 'site-settings', depth: 1 })
  } catch {
    return null
  }
}

// Convertir un hex a triplete "R G B" sin coma — útil para mezclar con opacidades
function hexToRgbString(hex: string | null | undefined, fallback: string): string {
  const c = (hex || fallback).replace('#', '')
  if (c.length !== 6) return hexToRgbString(fallback, fallback)
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

// Convertir un hex a "H S% L%" — formato esperado por Tailwind/shadcn con hsl(var(--x))
function hexToHsl(hex: string | null | undefined, fallback: string): string {
  const c = ((hex || fallback).replace('#', '')) as string
  if (c.length !== 6) return hexToHsl(fallback, fallback)
  let r = parseInt(c.slice(0, 2), 16) / 255
  let g = parseInt(c.slice(2, 4), 16) / 255
  let b = parseInt(c.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

const RADIUS_VALUES: Record<string, string> = {
  none: '0px',
  medium: '0.5rem',
  large: '1rem',
  pill: '999px',
}

const FONT_SIZE_VALUES: Record<string, string> = {
  small: '15px',
  medium: '16px',
  large: '18px',
}

const DENSITY_VALUES: Record<string, { containerPy: string; sectionPy: string; cardPad: string }> = {
  compact: { containerPy: '1.5rem', sectionPy: '2.5rem', cardPad: '0.75rem' },
  normal: { containerPy: '2rem', sectionPy: '4rem', cardPad: '1rem' },
  airy: { containerPy: '3rem', sectionPy: '6rem', cardPad: '1.5rem' },
}

export type SiteTheme = {
  /** Bloque CSS con las variables del tema, para inyectar en <style>. */
  css: string
  /** Hoja de Google Fonts con las dos fuentes del cliente. */
  fontsHref: string
  /** URL del favicon del cliente, si lo tiene. */
  faviconUrl: string | null
}

export function buildSiteTheme(settings: any): SiteTheme {
  const primary = settings?.colorPrimary || '#7a4f23'
  const accent = settings?.colorAccent || '#b04621'
  const background = settings?.colorBackground || '#f5f1ea'
  const surface = settings?.colorSurface || '#ede8db'
  const text = settings?.colorText || '#1f1b17'
  const serif = settings?.fontSerif || 'Fraunces'
  const sans = settings?.fontSans || 'Inter'
  const radiusKey = settings?.cornerRadius || 'medium'
  const radius = RADIUS_VALUES[radiusKey] || RADIUS_VALUES.medium

  const fontSizeKey = settings?.fontSize || 'medium'
  const fontSize = FONT_SIZE_VALUES[fontSizeKey] || FONT_SIZE_VALUES.medium

  const densityKey = settings?.density || 'normal'
  const density = DENSITY_VALUES[densityKey] || DENSITY_VALUES.normal

  const buttonStyle = settings?.buttonStyle || 'solid'

  const serifFamily = serif.replace(/ /g, '+')
  const sansFamily = sans.replace(/ /g, '+')
  const fontsHref = `https://fonts.googleapis.com/css2?family=${serifFamily}:wght@400;500;600;700&family=${sansFamily}:wght@400;500;600;700&display=swap`

  const css = `:root{
    --background:${hexToHsl(background, '#f5f1ea')};
    --foreground:${hexToHsl(text, '#1f1b17')};
    --primary:${hexToHsl(primary, '#7a4f23')};
    --primary-foreground:${hexToHsl(background, '#f5f1ea')};
    --accent:${hexToHsl(accent, '#b04621')};
    --accent-foreground:${hexToHsl(background, '#f5f1ea')};
    --secondary:${hexToHsl(surface, '#ede8db')};
    --secondary-foreground:${hexToHsl(text, '#1f1b17')};
    --muted:${hexToHsl(surface, '#ede8db')};
    --card:${hexToHsl(background, '#f5f1ea')};
    --card-foreground:${hexToHsl(text, '#1f1b17')};
    --ring:${hexToHsl(primary, '#7a4f23')};
    --radius:${radius};
    --brand-primary:${primary};
    --brand-primary-rgb:${hexToRgbString(primary, '#7a4f23')};
    --brand-accent:${accent};
    --brand-bg:${background};
    --brand-surface:${surface};
    --brand-text:${text};
    --brand-font-size:${fontSize};
    --brand-container-py:${density.containerPy};
    --brand-section-py:${density.sectionPy};
    --brand-card-pad:${density.cardPad};
    --brand-button-style:${buttonStyle};
    --font-sans:'${sans}',system-ui,-apple-system,sans-serif;
    --font-serif:'${serif}',Georgia,serif;
  }
  html{font-size:${fontSize};}`

  const faviconUrl =
    settings?.favicon && typeof settings.favicon === 'object' && settings.favicon.url
      ? settings.favicon.url
      : null

  return { css, fontsHref, faviconUrl }
}
