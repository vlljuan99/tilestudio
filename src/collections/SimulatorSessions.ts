import type { CollectionConfig } from 'payload'

export const SimulatorSessions: CollectionConfig = {
  slug: 'simulator-sessions',
  labels: { singular: 'Sesión simulador', plural: 'Sesiones simulador' },
  admin: {
    useAsTitle: 'token',
    group: 'Simulador',
    defaultColumns: ['token', 'generationCount', 'expiresAt', 'lead', 'createdAt'],
    description:
      'Información técnica de las sesiones del simulador. No necesitas usar esto normalmente.',
    // Ocultar del menú lateral — info técnica que el cliente no necesita ver.
    // Sigue accesible por URL si alguna vez hace falta.
    hidden: () => true,
  },
  access: {
    // Lectura pública controlada por token (filtrada en el endpoint, no aquí).
    read: () => true,
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'token',
      label: 'Token',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: '64 hex chars. Equivale a un secreto compartido con el cliente.' },
    },
    {
      name: 'generationCount',
      label: 'Generaciones usadas',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'expiresAt',
      label: 'Expira',
      type: 'date',
      required: true,
    },
    {
      name: 'lead',
      label: 'Lead asociado',
      type: 'relationship',
      relationTo: 'leads',
      admin: { description: 'Se rellena si la sesión llega a conversión.' },
    },
    {
      name: 'meta',
      label: 'Metadatos',
      type: 'json',
      admin: { description: 'IP hash, user agent, etc. (no PII directa).' },
    },
  ],
  timestamps: true,
}
