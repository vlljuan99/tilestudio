import type { Metadata } from 'next'

import './globals.css'
import { SiteHeader } from '@/components/site/Header'
import { SiteFooter } from '@/components/site/Footer'
import { WhatsAppFab } from '@/components/site/WhatsAppFab'
import { getSiteSettings, buildSiteTheme } from '@/lib/theme'

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings()
  const theme = buildSiteTheme(settings)

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={theme.fontsHref} />
        <style dangerouslySetInnerHTML={{ __html: theme.css }} />
        {theme.faviconUrl && <link rel="icon" href={theme.faviconUrl} />}
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
