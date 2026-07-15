import { TileForm, emptyTile } from '@/components/ventas/TileForm'

export const metadata = { title: 'Nuevo azulejo' }

export default function NuevoAzulejoPage() {
  return <TileForm initial={emptyTile()} />
}
