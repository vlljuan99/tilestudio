# Roadmap

Ideas acordadas pero aún no implementadas. Lo que ya está hecho no vive aquí:
está en el código y en el historial de git.

## Roles de comercial (acordado 2026-07-16, sin hacer)

Hoy **cualquier usuario con cuenta ve las dos zonas**: `/ventas` y el admin
técnico de Payload en `/admin`. Se decidió así a propósito para arrancar, pero
en cuanto el cliente dé acceso a comerciales de verdad, lo normal es que ellos
solo vean `/ventas`.

Qué haría falta:

- La colección `Users` (`src/collections/Users.ts`) **ya tiene el campo `role`**
  con opciones `admin` / `editor`; hoy no se usa para nada. Habría que añadir
  `comercial` (o reutilizar `editor`).
- Bloquear el admin de Payload a ese rol: `admin.access` en `payload.config.ts`
  → solo `admin`. Ojo: eso no basta para proteger los datos, solo esconde la UI.
- Revisar el `access` de cada colección para que un comercial pueda escribir lo
  suyo (tiles, ambients, selections, leads) pero no tocar `users` ni
  `site-settings`.
- El guard de `/ventas` (`src/app/(ventas)/ventas/(panel)/layout.tsx`) ya exige
  sesión; no haría falta cambiarlo salvo que se quiera excluir a alguien.
- Quitar el enlace "Admin técnico →" del sidebar (`VentasSidebar.tsx`) para
  quien no sea admin.

## Otras ideas sueltas

- **Limpiar colores heredados**: la normalización nueva (`src/lib/taxonomy.ts`)
  evita que se creen colores casi duplicados en importaciones futuras, pero los
  que ya existen en base de datos siguen ahí. Haría falta un merge parecido al
  que se hizo a mano con las marcas Pamesa.
- **Marca "Riv. Aquastone"**: basura de extracción en la BD de desarrollo (no es
  una marca, es un prefijo de serie). Sin referencias; pendiente de decidir si
  se borra.
