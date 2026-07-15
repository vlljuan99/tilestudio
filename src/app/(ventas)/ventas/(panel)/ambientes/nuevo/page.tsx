import { AmbientForm, emptyAmbient } from '@/components/ventas/AmbientForm'

export const metadata = { title: 'Nuevo ambiente' }

export default function NuevoAmbientePage() {
  return <AmbientForm initial={emptyAmbient()} />
}
