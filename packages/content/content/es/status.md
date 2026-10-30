---
layout: default
title: "Estado de MagicSync: Disponibilidad de la Plataforma"
description: "Estado actual de la aplicación web, la API, el programador, los procesos de publicación, los servicios de IA y la entrega de contenido de MagicSync."
head:
  htmlAttrs:
    lang: es
  meta:
    - name: keywords
      content: "estado de MagicSync, disponibilidad, caída del servicio, API, fallo al publicar, estado de la plataforma"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Equipo MagicSync"
    - name: description
      content: "Estado actual de la aplicación web, la API, el programador, los procesos de publicación, los servicios de IA y la entrega de contenido de MagicSync."
ogImage:
  component: BlogOgImage
  props:
    title: "Estado de la Plataforma MagicSync"
    description: "Disponibilidad de servicios y gestión de incidencias"
    headline: "Estado de la Plataforma en Vivo"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Todos los Sistemas
  content: Servicios principales operativos
actions:
  - label: Reportar un Problema
    href: /support
    icon: "lucide:arrow-right"
  - label: Ver el Changelog
    href: /changelog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Panel de estado de los servicios de MagicSync"
---
#title
Estado de la Plataforma <span class="gradient-text">en Vivo</span>

#description
La forma más rápida de saber si el problema está de nuestro lado. Durante una incidencia, esta página se actualiza primero, antes de que se llenen las colas de soporte.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Estado de la nube gestionada

| Servicio | Estado | Qué cubre |
|---|---|---|
| Aplicación web | Operativa | Acceso, panel, calendario y compositor |
| API pública | Operativa | Peticiones a `/api/v1/*` y acceso con claves |
| Programador | Operativo | Envío de publicaciones en cola y por hora |
| Procesos de publicación | Operativos | Entrega a las redes sociales conectadas |
| Servicios de IA | Operativos | Generación de textos, ganchos y reutilización |
| Medios y subidas | Operativos | Subida, almacenamiento y entrega de recursos |
| MCP y agentes | Operativos | Herramientas de `/mcp`, sesiones de chat y tablero de contenido |

**Última revisión:** octubre de 2026. La nube gestionada apunta a un 99.9% de disponibilidad mensual para la web, la API y el programador.

## Si una publicación programada no salió

1. Abre la publicación y lee el error por plataforma. La mayoría de fallos vienen de un token caducado, un permiso ausente o un formato de medio rechazado.
2. Reconecta la cuenta afectada desde la pantalla de integraciones.
3. Reintenta solo la plataforma fallida. MagicSync omite las que ya publicaron para que tus seguidores no vean duplicados.

## Instalaciones auto-hospedadas

Si ejecutas la edición Docker, tu disponibilidad depende de tu propia infraestructura. Usa el endpoint de salud desde tu monitorización y toma esta página como referencia de las APIs sociales, no como un informe de tu servidor.

## Cómo se gestionan las incidencias

Clasificamos una incidencia como **degradada** cuando la publicación se retrasa pero queda en cola, y como **caída** cuando no se pueden encolar ni entregar publicaciones nuevas. Durante una caída, el soporte prioriza las publicaciones urgentes y los calendarios afectados se reintentan automáticamente cuando se recupera la dependencia.

</section>

::BaseFaq
---
list:
  - label: ¿Esta página monitoriza mi instalación auto-hospedada?
    content: No. Informa sobre la nube gestionada de MagicSync. Tu instalación tiene sus propios registros y comprobaciones de salud.
    value: '1'
  - label: ¿Cada cuánto se actualiza el estado?
    content: Al inicio y al final de cada incidencia, y al menos cada 30 minutos mientras una incidencia está activa.
    value: '2'
  - label: ¿Las publicaciones perdidas se publican solas tras una caída?
    content: Las publicaciones en cola se reintentan cuando se recupera la dependencia. Las que ya pasaron su ventana horaria se marcan para revisión en lugar de publicarse horas tarde.
    value: '3'
  - label: ¿Dónde reporto un problema que no aparece aquí?
    content: Envíalo desde la página de soporte con el ID de publicación, la plataforma y la hora aproximada. Así podemos correlacionarlo rápido con los registros del servidor.
    value: '4'
---

#title
Preguntas sobre el Estado
#subtitle
Cómo leer esta página y qué hacer cuando algo parece fallar.
::

::BaseCallToAction
---
title: ¿Sigues Viendo un Problema?
description: Envíanos el ID de la publicación y la plataforma. Lo rastrearemos en los registros de publicación.
primaryAction:
  label: Contactar Soporte
  href: /support
secondaryAction:
  label: Leer las Guías
  href: /guides
---
::
