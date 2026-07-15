import { SimpleCrud } from '@/components/ventas/SimpleCrud'

export const metadata = { title: 'Marcas' }

export default function MarcasPage() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl">Marcas</h1>
        <p className="text-sm text-muted-foreground">
          Los fabricantes con los que trabajas (Pamesa, Mykonos, Vitacer…).
        </p>
      </header>
      <SimpleCrud
        collection="brands"
        itemLabel="la marca"
        fields={[
          { name: 'logo', label: 'Logo', type: 'image' },
          { name: 'description', label: 'Descripción', type: 'textarea' },
        ]}
      />
    </div>
  )
}
