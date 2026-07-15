import { SimpleCrud } from '@/components/ventas/SimpleCrud'

export const metadata = { title: 'Colecciones' }

export default function ColeccionesPage() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl">Colecciones</h1>
        <p className="text-sm text-muted-foreground">
          Series de cada marca para agrupar azulejos (Albar, Cōre, Hamptons…).
        </p>
      </header>
      <SimpleCrud
        collection="collections"
        itemLabel="la colección"
        subtitleField="brand"
        fields={[
          { name: 'brand', label: 'Marca', type: 'relation', collection: 'brands' },
          { name: 'description', label: 'Descripción', type: 'textarea' },
          { name: 'coverImage', label: 'Imagen de portada', type: 'image' },
        ]}
      />
    </div>
  )
}
