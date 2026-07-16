import type { CollectionConfig } from 'payload'

/**
 * Selección de azulejos que un comercial comparte con un cliente concreto.
 *
 * El comercial marca varios azulejos en la zona de ventas y genera un enlace
 * (`/seleccion/<token>`) para mandarlo por WhatsApp. El cliente lo abre sin
 * cuenta ni contraseña: el token ES la credencial, por eso se genera aleatorio
 * y largo, y la lectura pública se filtra por token en la propia página.
 */
export const Selections: CollectionConfig = {
  slug: 'selections',
  labels: { singular: 'Selección para cliente', plural: 'Selecciones para clientes' },
  admin: {
    useAsTitle: 'title',
    group: 'Clientes',
    defaultColumns: ['title', 'clientName', 'viewCount', 'createdAt'],
    description:
      'Selecciones de azulejos que los comerciales han enviado a clientes. Se crean desde la zona de ventas.',
  },
  access: {
    // La página pública busca por token exacto: sin el token no se llega a nada.
    // Los listados de la zona de ventas van con sesión.
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: () => true, // el contador de visitas se incrementa sin sesión
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'title',
      label: 'Título',
      type: 'text',
      required: true,
      admin: { description: 'Lo que verá el cliente como encabezado.' },
    },
    {
      name: 'token',
      label: 'Token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Parte secreta del enlace. Quien lo tenga puede ver la selección.',
      },
    },
    {
      name: 'clientName',
      label: 'Cliente',
      type: 'text',
      admin: { description: 'Para saber a quién se la mandaste. Opcional.' },
    },
    {
      name: 'note',
      label: 'Nota para el cliente',
      type: 'textarea',
    },
    {
      name: 'tiles',
      label: 'Azulejos',
      type: 'relationship',
      relationTo: 'tiles',
      hasMany: true,
      required: true,
    },
    {
      name: 'createdBy',
      label: 'Creada por',
      type: 'relationship',
      relationTo: 'users',
      admin: { readOnly: true },
    },
    {
      name: 'viewCount',
      label: 'Veces vista',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
  ],
  timestamps: true,
}
