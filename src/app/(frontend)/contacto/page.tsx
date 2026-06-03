import { getPayload } from 'payload'
import config from '@payload-config'
import { buildWhatsAppLink } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MessageCircle, Mail, Phone, MapPin } from 'lucide-react'

export const metadata = { title: 'Contacto' }

export default async function ContactPage() {
  const payload = await getPayload({ config })
  let settings: any = null
  try {
    settings = await payload.findGlobal({ slug: 'site-settings' })
  } catch {}

  const wa = buildWhatsAppLink({
    number: settings?.whatsappNumber,
    message: 'Hola, vengo de la página de contacto.',
  })

  return (
    <div className="container py-12 md:py-16 max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl">Contacto</h1>
        <p className="text-muted-foreground">
          Te asesoramos sin compromiso. El canal más rápido es WhatsApp.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        {wa && (
          <Button asChild size="lg" variant="whatsapp" className="h-auto py-4">
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
            </a>
          </Button>
        )}
        {settings?.email && (
          <Button asChild size="lg" variant="outline" className="h-auto py-4">
            <a href={`mailto:${settings.email}`}>
              <Mail className="h-5 w-5" /> Enviar email
            </a>
          </Button>
        )}
      </div>

      <dl className="grid sm:grid-cols-2 gap-y-6 text-sm border-t border-border pt-8">
        {settings?.phone && (
          <div className="flex gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Teléfono</dt>
              <dd>{settings.phone}</dd>
            </div>
          </div>
        )}
        {settings?.email && (
          <div className="flex gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Email</dt>
              <dd>{settings.email}</dd>
            </div>
          </div>
        )}
        {settings?.address && (
          <div className="flex gap-3 sm:col-span-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">Showroom</dt>
              <dd className="whitespace-pre-line">{settings.address}</dd>
              {settings.openingHours && (
                <dd className="whitespace-pre-line text-muted-foreground mt-1">
                  {settings.openingHours}
                </dd>
              )}
            </div>
          </div>
        )}
      </dl>
    </div>
  )
}
