import type { CollectionConfig } from 'payload'

export const Rooms: CollectionConfig = {
  slug: 'rooms',
  labels: { singular: 'Estancia', plural: 'Estancias' },
  admin: {
    useAsTitle: 'name',
    group: 'Etiquetas',
    description:
      'Estancias de la casa (baño, cocina, salón, dormitorio, exterior). Cuando etiquetas un azulejo con su estancia, los clientes pueden filtrar el catálogo por habitación.',
  },
  access: { read: () => true },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Slug', type: 'text', required: true, unique: true },
  ],
}
