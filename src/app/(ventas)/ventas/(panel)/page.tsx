import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Inicio' }

const LEAD_STATUS: Record<string, string> = {
  new: 'Nuevo',
  contacting: 'En contacto',
  won: 'Ganado',
  lost: 'Perdido',
  discarded: 'Descartado',
}

export default async function VentasHome() {
  const payload = await getPayload({ config })

  const [tiles, published, brands, ambients, newLeads, imports, leads] = await Promise.all([
    payload.count({ collection: 'tiles' }),
    payload.count({ collection: 'tiles', where: { published: { equals: true } } }),
    payload.count({ collection: 'brands' }),
    payload.count({ collection: 'ambients' }),
    payload.count({ collection: 'leads', where: { status: { equals: 'new' } } }),
    payload.find({ collection: 'pdf-imports', limit: 3, sort: '-updatedAt', depth: 0 }),
    payload.find({ collection: 'leads', limit: 5, sort: '-createdAt', depth: 0 }),
  ])

  const activeImports = imports.docs.filter((d: any) => d.status === 'processing')

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Lo esencial de tu catálogo y tus clientes, de un vistazo.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Azulejos publicados" value={`${published.totalDocs}/${tiles.totalDocs}`} href="/ventas/azulejos" />
        <Stat label="Marcas" value={brands.totalDocs} href="/ventas/marcas" />
        <Stat label="Ambientes" value={ambients.totalDocs} href="/ventas/ambientes" />
        <Stat label="Clientes nuevos" value={newLeads.totalDocs} href="/ventas/clientes" highlight={newLeads.totalDocs > 0} />
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        <Link
          href="/ventas/importar/nuevo"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
        >
          + Importar un catálogo PDF
        </Link>
        <Link
          href="/ventas/azulejos/nuevo"
          className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted"
        >
          + Añadir un azulejo
        </Link>
        <Link
          href="/ventas/ambientes/nuevo"
          className="px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-muted"
        >
          + Añadir un ambiente
        </Link>
      </div>

      {activeImports.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-2">Importaciones en marcha</h2>
          <div className="grid gap-2">
            {activeImports.map((d: any) => (
              <Link
                key={d.id}
                href={`/ventas/importar/${d.id}`}
                className="flex items-center gap-3 border border-border rounded-lg p-3 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    Página {d.processedPages || 0} de {d.totalPages || '?'} ·{' '}
                    {d.candidatesCount || 0} azulejos encontrados
                  </p>
                </div>
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${d.progressPercent || 0}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold">Últimos clientes interesados</h2>
          <Link href="/ventas/clientes" className="text-xs text-muted-foreground hover:underline">
            ver todos →
          </Link>
        </div>
        {leads.docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no ha llegado ninguno.</p>
        ) : (
          <div className="border border-border rounded-lg divide-y divide-border">
            {leads.docs.map((l: any) => (
              <Link
                key={l.id}
                href="/ventas/clientes"
                className="flex items-center gap-3 p-3 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {l.comment || l.email || l.phone || '—'}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted shrink-0">
                  {LEAD_STATUS[l.status] || l.status}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(l.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  href,
  highlight,
}: {
  label: string
  value: number | string
  href: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={`border rounded-lg p-3 hover:bg-muted/40 transition-colors ${
        highlight ? 'border-primary bg-primary/5' : 'border-border'
      }`}
    >
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Link>
  )
}
