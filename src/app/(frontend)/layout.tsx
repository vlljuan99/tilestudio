import type { Metadata } from 'next'
import { Inter, Fraunces } from 'next/font/google'
import { getPayload } from 'payload'
import config from '@payload-config'

import './globals.css'
import { SiteHeader } from '@/components/site/Header'
import { SiteFooter } from '@/components/site/Footer'
import { WhatsAppFab } from '@/components/site/WhatsAppFab'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600'],
})

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
    return settings
  } catch {
    return null
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()

  return (
    <html lang="es" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-screen flex flex-col">
        <SiteHeader settings={settings} />
        <main className="flex-1">{children}</main>
        <SiteFooter settings={settings} />
        <WhatsAppFab settings={settings} />
      </body>
    </html>
  )
}
