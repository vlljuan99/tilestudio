import type { Metadata } from 'next'
import { getPayload } from 'payload'
import config from '@payload-config'

import './globals.css'
import { SiteHeader } from '@/components/site/Header'
import { SiteFooter } from '@/components/site/Footer'
import { WhatsAppFab } from '@/components/site/WhatsAppFab'

// Toda la web pública depende de SiteSettings (paleta, fuentes, branding) de la
// BD, así que no tiene sentido prerenderizar en build-time (la BD aún está
// vacía). Forzamos server-render dinámico en todas las páginas del grupo
// (frontend), incluida la home.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: {
    default: 'Tilestudio — Showroom de azulejos con simulación IA',
    template: '%s · Tilestudio',
  },
  description:
    'Explora nuestro catálogo de azulejos y prueba con IA cómo quedarían en tu espacio antes de decidir.',
}

async function getSettings() {
  const payload = await getPayload({ config })
  try {
    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 1 })
    return settings as any
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()

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

  // Cargamos las dos fuentes elegidas desde Google Fonts en HEAD
  const serifFamily = serif.replace(/ /g, '+')
  const sansFamily = sans.replace(/ /g, '+')
  const fontsHref = `https://fonts.googleapis.com/css2?family=${serifFamily}:wght@400;500;600;700&family=${sansFamily}:wght@400;500;600;700&display=swap`

  // Sobreescribimos las CSS variables que usa Tailwind (HSL) con la paleta
  // del cliente. También exponemos los hex en --brand-* por si algún componente
  // los quiere usar directamente.
  const themeVars = `:root{
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

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={fontsHref} />
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
      </head>
      <body className="min-h-screen flex flex-col">
        <SiteHeader settings={settings} />
        <main className="flex-1">{children}</main>
        <SiteFooter settings={settings} />
        <WhatsAppFab settings={settings} />
      </body>
    </html>
  )
}
