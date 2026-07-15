import { getPayload } from 'payload'
import config from '@payload-config'

import { FavoritesList } from '@/components/catalog/FavoritesList'

export const metadata = {
  title: 'Mis favoritos',
  description: 'Los azulejos que has guardado para comparar y consultar.',
}

export default async function FavoritesPage() {
  const payload = await getPayload({ config })
  let whatsappNumber: string | null = null
  try {
    const settings = (await payload.findGlobal({ slug: 'site-settings' })) as any
    whatsappNumber = settings?.whatsappNumber || null
  } catch {
    // sin ajustes, la página funciona igual pero sin CTA de WhatsApp
  }

  return (
    <div className="container py-8 md:py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl">Mis favoritos</h1>
        <p className="text-muted-foreground max-w-prose">
          Tu selección se guarda en este dispositivo. Cuando la tengas lista, envíanosla por
          WhatsApp y te asesoramos sin compromiso.
        </p>
      </header>
      <FavoritesList whatsappNumber={whatsappNumber} />
    </div>
  )
}
