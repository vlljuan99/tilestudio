import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getSiteSettings } from '@/lib/theme'
import { VentasSidebar } from '@/components/ventas/VentasSidebar'

/**
 * Guard + estructura del panel de ventas: sin sesión se va al login propio;
 * con sesión, menú lateral fijo (colapsable en móvil) y el contenido.
 */
export default async function VentasPanelLayout({ children }: { children: React.ReactNode }) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (!user) redirect('/ventas/login')

  const settings = await getSiteSettings()
  const logo = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null

  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      <VentasSidebar
        siteName={settings?.siteName || 'Tilestudio'}
        logoUrl={logo?.url || null}
        userName={(user as any).name || (user as any).email}
      />
      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  )
}
