import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'

import { getSiteSettings } from '@/lib/theme'
import { VentasLogin } from '@/components/ventas/VentasLogin'

export const metadata = { title: 'Acceso' }

export default async function VentasLoginPage() {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() })
  if (user) redirect('/ventas')

  const settings = await getSiteSettings()
  const logo = settings?.logo && typeof settings.logo === 'object' ? settings.logo : null

  return (
    <VentasLogin
      siteName={settings?.siteName || 'Tilestudio'}
      logoUrl={logo?.url || null}
    />
  )
}
