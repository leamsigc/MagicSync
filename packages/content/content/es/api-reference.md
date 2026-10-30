---
layout: default
title: "Referencia de API: REST y MCP | MagicSync"
description: "Desarrolla sobre MagicSync con claves de API, endpoints REST con permisos para publicaciones, negocios, medios y analítica, y un servidor MCP para asistentes."
head:
  htmlAttrs:
    lang: es
  meta:
    - name: keywords
      content: "API redes sociales, API de programación, servidor MCP, claves de API, automatizar publicaciones, MagicSync API"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Equipo MagicSync"
    - name: description
      content: "Desarrolla sobre MagicSync con claves de API, endpoints REST con permisos para publicaciones, negocios, medios y analítica, y un servidor MCP para asistentes."
ogImage:
  component: BlogOgImage
  props:
    title: "Referencia de API de MagicSync"
    description: "Endpoints REST, permisos y servidor MCP"
    headline: "Construye sobre la API de MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: API para Desarrolladores
  content: REST, CLI y MCP
actions:
  - label: Crear una Clave
    href: /app/keys
    icon: "lucide:arrow-right"
  - label: Leer la Documentación
    href: /documentation
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Claves de API y documentación de endpoints de MagicSync"
---
#title
Construye sobre la <span class="gradient-text">API de MagicSync</span>

#description
Todo lo que hace la interfaz está disponible para scripts y asistentes de IA: crear publicaciones, encolarlas, revisar resultados y leer analítica con claves con permisos y auditoría.
::

::BaseFeatures
---
list:
  - title: Claves con Permisos
    description: Crea claves de solo lectura o acceso completo por espacio de trabajo. Revoca una clave al instante sin tocar el resto de tu automatización.
    icon: "lucide:key-round"
  - title: Grupos de Recursos REST
    description: Endpoints JSON predecibles para publicaciones, negocios, cuentas, medios, analítica, plantillas y el runtime de agentes.
    icon: "lucide:braces"
  - title: Servidor MCP
    description: Conecta Claude o cualquier cliente MCP para descubrir herramientas y recursos, y redactar o programar publicaciones en lenguaje natural.
    icon: "lucide:bot"
  - title: Auditoría de Cada Llamada
    description: Cada petición se atribuye a una clave y queda registrada, así ves qué automatización creó o cambió una publicación.
    icon: "lucide:scroll-text"
---
#title
Diseñada para Automatizar
#subtitle
Lo que puedes hacer con MagicSync
#description
Formas estables, permisos explícitos y registros que responden quién cambió esto.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Autenticación

Crea una clave en [Claves de API](/es/app/keys) y envíala como token bearer:

```bash
curl https://magicsync.dev/api/v1/posts \
  -H "Authorization: Bearer $MAGICSYNC_API_KEY"
```

Las claves pertenecen a un usuario y están limitadas a sus negocios. Las claves de solo lectura pueden listar y consultar; las de acceso completo pueden crear, actualizar, programar y publicar.

## Grupos de endpoints

| Grupo | Ruta base | Uso típico |
|---|---|---|
| Publicaciones | `/api/v1/posts` | Crear, actualizar, programar e inspeccionar |
| Negocios | `/api/v1/business` | Espacios, perfiles y contexto de marca |
| Cuentas | `/api/v1/accounts` | Cuentas sociales conectadas y estado |
| Medios | `/api/v1/media` | Subir y referenciar imágenes y vídeo |
| Analítica | `/api/v1/stats` | Alcance, interacción y rendimiento |
| Plantillas | `/api/v1/templates` | Plantillas de publicación y variables |
| Programador masivo | `/api/v1/bulk-scheduler` | Importaciones CSV y creación por lotes |
| Agentes | `/api/v1/agent` | Sesiones de chat, capacidades y ejecuciones |
| Claves de API | `/api/v1/api-keys` | Crear, listar y revocar claves |
| MCP | `/mcp` | Descubrimiento de herramientas para clientes de IA |

Los cuerpos exactos, parámetros y esquemas de respuesta se documentan por endpoint en la descripción OpenAPI que expone la instancia.

## MCP en un minuto

Apunta un cliente MCP a `https://magicsync.dev/mcp`, autentica con una clave u OAuth y el asistente podrá listar herramientas y recursos. Las acciones con aprobación siguen protegidas: el asistente redacta y encola, pero publicar depende de los permisos de la clave.

## CLI

La CLI complementaria envuelve la misma API para flujos de terminal, como importaciones masivas de texto y comprobaciones programadas. Consulta la [guía de la CLI](/es/blogs/magicsync-cli-social-media-automation).

</section>

::BaseFaq
---
list:
  - label: ¿Hay límite de peticiones?
    content: Sí. Las peticiones se limitan por clave y por IP, con límites más altos para claves autenticadas de espacio. Las respuestas incluyen indicaciones de reintento al alcanzar un límite.
    value: '1'
  - label: ¿Puede una clave publicar sin aprobación?
    content: Solo una clave de acceso completo puede publicar directamente. Las de solo lectura no crean ni modifican publicaciones, y los flujos con aprobación siguen requiriendo una decisión humana.
    value: '2'
  - label: ¿Ofrecen un esquema OpenAPI?
    content: Sí. La instancia expone una descripción OpenAPI de la API que puedes importar en Postman, Insomnia o un generador de clientes.
    value: '3'
  - label: ¿La API está disponible en instalaciones auto-hospedadas?
    content: Sí. Las mismas rutas se incluyen en la edición Docker. Apunta tu URL base a tu propio dominio.
    value: '4'
  - label: ¿Cómo roto una clave filtrada?
    content: Revócala de inmediato desde la pantalla de claves de API y crea un reemplazo. La revocación surte efecto en la siguiente petición.
    value: '5'
---

#title
Preguntas sobre la API
#subtitle
Autenticación, límites y seguridad del acceso programático.
::

::BaseCallToAction
---
title: Crea tu Primera Clave de API
description: Genera una clave con permisos y haz tu primera petición en un par de minutos.
primaryAction:
  label: Abrir Claves de API
  href: /app/keys
secondaryAction:
  label: Leer la Documentación
  href: /documentation
---
::
