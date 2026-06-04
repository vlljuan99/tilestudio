import type { CollectionConfig } from 'payload'

export const Leads: CollectionConfig = {
  slug: 'leads',
  labels: { singular: 'Cliente interesado', plural: 'Clientes interesados' },
  admin: {
    useAsTitle: 'displayName',
    group: 'Clientes',
    defaultColumns: ['displayName', 'preferredChannel', 'tileOfInterest', 'status', 'createdAt'],
    description:
      'Personas que han contactado contigo desde la web (a través del simulador, una ficha de azulejo o el formulario de contacto). Aquí ves su mensaje, qué azulejo les interesa y por qué canal prefieren que les respondas.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'displayName',
      label: 'Identificador',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Se calcula automáticamente con el nombre o el contacto.',
      },
      hooks: {
        beforeChange: [
          ({ data }) => {
            if (!data) return undefined
            return data.name || data.email || data.phone || 'Lead sin identificar'
          },
        ],
      },
    },
    {
      type: 'row',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text' },
        { name: 'phone', label: 'Teléfono', type: 'text' },
      ],
    },
    { name: 'email', label: 'Email', type: 'email' },
    {
      type: 'row',
      fields: [
        {
          name: 'sqMeters',
          label: 'Metros aprox.',
          type: 'number',
        },
        {
          name: 'dontKnowSqm',
          label: 'No sabe metros',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'comment',
      label: 'Comentario del cliente',
      type: 'textarea',
    },
    {
      name: 'preferredChannel',
      label: 'Canal preferido',
      type: 'select',
      options: [
        { label: 'WhatsApp', value: 'whatsapp' },
        { label: 'Email', value: 'email' },
        { label: 'Teléfono', value: 'phone' },
      ],
      defaultValue: 'whatsapp',
    },
    {
      name: 'source',
      label: 'Origen',
      type: 'select',
      options: [
        { label: 'Simulador IA', value: 'simulator' },
        { label: 'Ficha de producto', value: 'product_page' },
        { label: 'Footer / contacto general', value: 'footer' },
        { label: 'Página de contacto', value: 'contact_page' },
      ],
      defaultValue: 'footer',
    },
    {
      name: 'tileOfInterest',
      label: 'Azulejo de interés',
      type: 'relationship',
      relationTo: 'tiles',
    },
    {
      name: 'generationImageUrl',
      label: 'URL de simulación generada',
      type: 'text',
      admin: { description: 'Imagen generada por IA asociada a este lead, si la hay.' },
    },
    {
      name: 'sessionId',
      label: 'Sesión',
      type: 'text',
      admin: { description: 'Identificador de la sesión temporal del usuario.' },
    },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      defaultValue: 'new',
      options: [
        { label: 'Nuevo', value: 'new' },
        { label: 'En contacto', value: 'contacting' },
        { label: 'Ganado', value: 'won' },
        { label: 'Perdido', value: 'lost' },
        { label: 'Descartado', value: 'discarded' },
      ],
    },
    {
      name: 'consentAccepted',
      label: 'Consentimiento RGPD',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
  timestamps: true,
}
