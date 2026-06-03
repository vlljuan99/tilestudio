import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Sobre nosotros' }

export default async function AboutPage() {
  const payload = await getPayload({ config })
  let settings: any = null
  try {
    settings = await payload.findGlobal({ slug: 'site-settings' })
  } catch {}

  return (
    <div className="container py-12 md:py-16 max-w-2xl space-y-6">
      <h1 className="text-3xl md:text-4xl">Sobre nosotros</h1>
      <p className="text-muted-foreground leading-relaxed">
        {settings?.aboutShort ||
          'Somos un showroom de azulejos dedicado a hacer que la elección de tu material sea visual, inspiradora y sin sorpresas. Combinamos catálogo cuidado, atención cercana y nuevas herramientas como la simulación con IA para que veas el resultado antes de decidir.'}
      </p>
    </div>
  )
}
