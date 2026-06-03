import type { CollectionConfig } from 'payload'

export const Generations: CollectionConfig = {
  slug: 'generations',
  labels: { singular: 'Generación', plural: 'Generaciones' },
  admin: {
    useAsTitle: 'id',
    group: 'Simulador',
    defaultColumns: ['id', 'tile', 'status', 'surfaces', 'providerUsed', 'costCents', 'createdAt'],
    description: 'Cada simulación generada por IA. Vinculada a una sesión y a un azulejo.',
  },
  access: {
    read: () => true,
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: 'session',
      label: 'Sesión',
      type: 'relationship',
      relationTo: 'simulator-sessions',
      required: true,
      index: true,
    },
    {
      name: 'tile',
      label: 'Azulejo',
      type: 'relationship',
      relationTo: 'tiles',
      required: true,
    },
    {
      name: 'surfaces',
      label: 'Superficies aplicadas',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Suelo', value: 'floor' },
        { label: 'Pared', value: 'wall' },
      ],
      required: true,
    },
    {
      name: 'wallColor',
      label: 'Color pared (hex)',
      type: 'text',
      admin: { description: 'Si se cambia el color de la pared no cubierta por azulejos.' },
    },
    {
      name: 'userImage',
      label: 'Imagen del usuario',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'resultImage',
      label: 'Resultado generado',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'status',
      label: 'Estado',
      type: 'select',
      defaultValue: 'queued',
      options: [
        { label: 'En cola', value: 'queued' },
        { label: 'Procesando', value: 'processing' },
        { label: 'Completada', value: 'completed' },
        { label: 'Fallida', value: 'failed' },
      ],
      required: true,
    },
    {
      name: 'providerUsed',
      label: 'Proveedor IA',
      type: 'text',
      admin: { description: 'ej: openai:gpt-image-1' },
    },
    {
      name: 'promptUsed',
      label: 'Prompt enviado',
      type: 'textarea',
      admin: { description: 'Para auditoría y mejora iterativa.' },
    },
    {
      type: 'row',
      fields: [
        { name: 'costCents', label: 'Coste (céntimos)', type: 'number' },
        { name: 'latencyMs', label: 'Latencia (ms)', type: 'number' },
      ],
    },
    {
      name: 'errorMessage',
      label: 'Mensaje de error',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
