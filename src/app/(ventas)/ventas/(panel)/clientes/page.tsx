import { LeadsList } from '@/components/ventas/LeadsList'

export const metadata = { title: 'Clientes interesados' }

export default function ClientesPage() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl">Clientes interesados</h1>
        <p className="text-sm text-muted-foreground">
          Personas que han dejado su contacto en la web. Respóndeles por su canal preferido y ve
          marcando cómo va cada uno.
        </p>
      </header>
      <LeadsList />
    </div>
  )
}
