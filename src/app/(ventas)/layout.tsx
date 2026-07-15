import type { Metadata } from 'next'

import '../(frontend)/globals.css'
import { getSiteSettings, buildSiteTheme } from '@/lib/theme'

// La zona de ventas depende de SiteSettings (paleta, fuentes) y de la sesión:
// siempre server-render dinámico.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: {
    default: 'Zona de ventas · Tilestudio',
    template: '%s · Zona de ventas',
  },
  robots: { index: false },
}

/**
 * Root layout de la zona de ventas: mismo tema visual que la web pública pero
 * SIN el header/footer del escaparate — aquí trabajan los comerciales.
 */
export default async function VentasRootLayout({ children }: { children: React.ReactNode }) {
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
      <body className="min-h-screen bg-background text-foreground">{children}</body>
    </html>
  )
}
