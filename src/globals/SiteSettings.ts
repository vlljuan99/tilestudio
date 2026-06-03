import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Configuración del sitio',
  admin: {
    group: 'Sistema',
    description:
      'Datos de marca, contacto y contenidos editables. Todo es configurable sin tocar código.',
  },
  access: {
    read: () => true,
    update: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Marca',
          fields: [
            { name: 'siteName', label: 'Nombre del sitio', type: 'text', defaultValue: 'Tilestudio' },
            {
              name: 'tagline',
              label: 'Frase de marca',
              type: 'text',
              defaultValue: 'Showroom de azulejos con simulación visual por IA',
            },
            { name: 'logo', label: 'Logo', type: 'upload', relationTo: 'media' },
          ],
        },
        {
          label: 'Contacto',
          fields: [
            {
              name: 'whatsappNumber',
              label: 'Número de WhatsApp',
              type: 'text',
              admin: {
                description:
                  'Formato internacional sin signos: ej. 34600000000. Usado para wa.me/<numero>.',
              },
            },
            { name: 'phone', label: 'Teléfono', type: 'text' },
            { name: 'email', label: 'Email comercial', type: 'email' },
            { name: 'address', label: 'Dirección del showroom', type: 'textarea' },
            { name: 'openingHours', label: 'Horario', type: 'textarea' },
          ],
        },
        {
          label: 'Home',
          fields: [
            { name: 'heroTitle', label: 'Título hero', type: 'text' },
            { name: 'heroSubtitle', label: 'Subtítulo hero', type: 'textarea' },
            {
              name: 'heroImage',
              label: 'Imagen hero',
              type: 'upload',
              relationTo: 'media',
            },
            {
              name: 'aboutShort',
              label: 'Sobre nosotros (resumen)',
              type: 'textarea',
            },
          ],
        },
        {
          label: 'Legal',
          fields: [
            {
              name: 'companyLegalName',
              label: 'Razón social',
              type: 'text',
            },
            {
              name: 'companyCif',
              label: 'CIF / NIF',
              type: 'text',
            },
            {
              name: 'privacyPolicyUrl',
              label: 'URL Política de privacidad',
              type: 'text',
            },
            {
              name: 'cookiesPolicyUrl',
              label: 'URL Política de cookies',
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
}
