import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Selección de azulejos', robots: { index: false } }

const PRICE_UNIT: Record<string, string> = {
  m2: '€/m²',
  unit: '€/ud.',
  box: '€/caja',
}

/**
 * Selección que un comercial ha compartido con un cliente. Sin login: el token
 * del enlace es la credencial, así que se busca por token exacto y se exige una
 * longitud mínima para que no se pueda tantear con tokens cortos.
 */
export default async function SeleccionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!token || token.length < 32) notFound()

  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'selections',
    where: { token: { equals: token } },
    limit: 1,
    depth: 2,
  })
  const selection = res.docs[0] as any
  if (!selection) notFound()

  // Contador de visitas: informativo para el comercial ("¿lo ha abierto?").
  // Si falla no debe tumbar la página del cliente.
  try {
    await payload.update({
      collection: 'selections',
      id: selection.id,
      data: { viewCount: (selection.viewCount || 0) + 1 } as any,
    })
  } catch {}

  const tiles = (selection.tiles || []).filter((t: any) => t && typeof t === 'object')

  return (
    <div className="container py-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-serif">{selection.title}</h1>
        {selection.clientName && (
          <p className="text-muted-foreground mt-1">Para {selection.clientName}</p>
        )}
        {selection.note && <p className="mt-3 whitespace-pre-wrap">{selection.note}</p>}
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {tiles.map((t: any) => {
          const img = typeof t.mainImage === 'object' ? t.mainImage : null
          const brand = typeof t.brand === 'object' ? t.brand?.name : null
          const format = typeof t.format === 'object' ? t.format?.name : null
          return (
            <article key={t.id} className="border border-border rounded-lg overflow-hidden bg-card">
              {img?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={t.name} className="w-full aspect-square object-cover" />
              ) : (
                <div className="w-full aspect-square bg-muted" />
              )}
              <div className="p-3">
                <p className="font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[brand, format].filter(Boolean).join(' · ') || ' '}
                </p>
                {t.orientativePrice ? (
                  <p className="text-sm mt-1">
                    {t.orientativePrice} {PRICE_UNIT[t.priceUnit] || '€'}{' '}
                    <span className="text-xs text-muted-foreground">(orientativo)</span>
                  </p>
                ) : null}
                {t.published && t.slug && (
                  <Link
                    href={`/catalogo/${t.slug}`}
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    Ver ficha completa →
                  </Link>
                )}
              </div>
            </article>
          )
        })}
      </div>

      <footer className="mt-10 pt-6 border-t border-border text-sm text-muted-foreground">
        <p>
          Precios orientativos, sujetos a confirmación. ¿Dudas?{' '}
          <Link href="/contacto" className="text-primary hover:underline">
            Contacta con nosotros
          </Link>
          .
        </p>
      </footer>
    </div>
  )
}
