---
layout: default
title: "Changelog de MagicSync: Novedades del Producto"
description: "Sigue lo que se publica en MagicSync: mejoras del calendario, tablero de contenido, facturación, seguridad, nuevas integraciones y rendimiento."
head:
  htmlAttrs:
    lang: es
  meta:
    - name: keywords
      content: "changelog MagicSync, novedades del producto, notas de versión, nuevas funciones, actualizaciones de MagicSync"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Equipo MagicSync"
    - name: description
      content: "Sigue lo que se publica en MagicSync: mejoras del calendario, tablero de contenido, facturación, seguridad, nuevas integraciones y rendimiento."
ogImage:
  component: BlogOgImage
  props:
    title: "Changelog de MagicSync"
    description: "Novedades, correcciones y mejoras del producto"
    headline: "Descubre lo Nuevo en MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Changelog
  content: Publicado, no prometido
actions:
  - label: Leer Notas de Versión
    href: /release-notes
    icon: "lucide:arrow-right"
  - label: Ver el Blog
    href: /blog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Línea de tiempo del changelog de MagicSync"
---
#title
Descubre lo <span class="gradient-text">Nuevo en MagicSync</span>

#description
Un registro continuo de cambios relevantes: nuevos flujos, correcciones de seguridad, trabajo de rendimiento e integraciones. Los retoques de texto se quedan fuera; lo que afecta tu día a día, no.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Octubre de 2026

### Calendario reconstruido sobre Nuxt UI
Sustituimos el calendario heredado por uno nativo con vistas de día, semana y mes. Las publicaciones pendientes se arrastran para reprogramar, las vistas previas por plataforma acompañan al cambio y los calendarios se comparten por negocio.

### Vistas de colección compartidas
Negocios, integraciones y otros directorios comparten ahora un mismo sistema de colecciones con cambio de vista, búsqueda, filtros y ordenación. Menos pantallas inconsistentes y navegación más rápida.

### Tablero de contenido, perfil y facturación
Las tarjetas de contenido funcionan como tarjetas de tarea con estados, prioridades, fechas relativas y menús contextuales. La facturación incorporó pantallas de plan, pago y facturas con Stripe, y el perfil pasó a ser la única vista de cuenta.

### Conexiones de Snapchat y dev-null.sh
Añadimos Snapchat mediante un proveedor OAuth oficial y una conexión de publicación con dev-null.sh, cada una con su guía de configuración.

### Seguridad y rendimiento de la API
La API resuelve la sesión una vez por petición, activa una caché corta de cookies de sesión, protege las llamadas salientes contra SSRF, cifra los tokens sociales en reposo y añade limitación de tasa y cabeceras de seguridad más estrictas.

### Metadatos de YouTube y reintento parcial
Las subidas a YouTube derivan un título y etiquetas razonables del contenido, y reintentar una plataforma fallida ya no vuelve a publicar las que sí funcionaron.

## Septiembre de 2026

### Plataforma de agentes y tablero de contenido
El runtime de agentes en proceso, el tablero de contenido por negocio, los escaneos de tendencias, las comprobaciones SEO/GEO y la publicación con aprobación pasaron al producto principal.

## Agosto de 2026

### Despliegue auto-hospedado
Publicamos la ruta de despliegue con Docker, un contenedor sin privilegios de root, variables de entorno documentadas y una configuración guiada en el primer arranque.

</section>

::BaseFeatures
---
list:
  - title: Ritmo de Publicación
    description: Las correcciones salen de forma continua; las funciones grandes llegan por oleadas temáticas para que la documentación y las capturas sigan vigentes.
    icon: "lucide:rocket"
  - title: Compatibilidad Hacia Atrás
    description: Las publicaciones programadas siguen saliendo cuando cambian las tripas. Las deprecaciones se anuncian antes de eliminarlas.
    icon: "lucide:shield-check"
  - title: Señales Públicas del Roadmap
    description: Los artículos del blog explican el razonamiento detrás de los cambios grandes, incluidas las contrapartidas aceptadas.
    icon: "lucide:map"
---
#title
Cómo Publicamos
#subtitle
Lo que puedes hacer con MagicSync
#description
Un ritmo predecible es mejor que un mega-lanzamiento sorpresa que nadie puede planificar.
::

::BaseCallToAction
---
title: ¿Quieres el Detalle Detrás de un Cambio?
description: Las notas de versión extendidas y los artículos de arquitectura viven en el blog y en la documentación.
primaryAction:
  label: Leer Notas de Versión
  href: /release-notes
secondaryAction:
  label: Ver el Blog
  href: /blog
---
::
