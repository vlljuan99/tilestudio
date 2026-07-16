import Link from 'next/link'
import { getPayload } from 'payload'
import config from '@payload-config'

import { SelectionsList } from '@/components/ventas/SelectionsList'

export const metadata = { title: 'Selecciones enviadas' }

export default async function SeleccionesPage() {
  const payload = await getPayload({ config })
  const res = await payload.find({
    collection: 'selections',
    limit: 100,
    sort: '-createdAt',
    depth: 1,
  })

  const selections = res.docs.map((s: any) => ({
    id: s.id,
    title: s.title,
    token: s.token,
    clientName: s.clientName || null,
    viewCount: s.viewCount || 0,
    tileCount: (s.tiles || []).length,
    createdAt: s.createdAt,
    createdBy:
      s.createdBy && typeof s.createdBy === 'object'
        ? s.createdBy.name || s.createdBy.email
        : null,
  }))

  return (
    <div className="max-w-3xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl">Selecciones enviadas</h1>
          <p className="text-sm text-muted-foreground">
            Enlaces de azulejos que has mandado a clientes. Se crean desde{' '}
            <Link href="/ventas/azulejos" className="text-primary hover:underline">
              Azulejos
            </Link>
            , seleccionando varios.
          </p>
        </div>
      </header>

      <SelectionsList selections={selections} />
    </div>
  )
}
