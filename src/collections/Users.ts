import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: 'Persona con acceso',
    plural: 'Personas con acceso',
  },
  admin: {
    useAsTitle: 'email',
    group: 'Configuración',
    description:
      'Las personas que pueden entrar a esta zona de administración. Crea aquí a tus comerciales o colaboradores para que puedan responder a los clientes interesados.',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      label: 'Nombre',
      type: 'text',
    },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      defaultValue: 'editor',
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
    },
  ],
}
