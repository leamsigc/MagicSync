---
layout: default
title: "Agentes de IA que Publican con MagicSync"
description: "Conecta ChatGPT, Claude, Cursor, Codex o cualquier cliente MCP a MagicSync. Investiga, redacta, programa y publica en 18 redes con aprobaciones y claves con permisos."
head:
  htmlAttrs:
    lang: es
  bodyAttrs:
    class: ""
  meta:
    - name: keywords
      content: "agente IA redes sociales, servidor MCP, ChatGPT redes sociales, Claude redes sociales, Cursor, Codex, programación con IA, MagicSync"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Equipo MagicSync"
    - name: description
      content: "Conecta ChatGPT, Claude, Cursor, Codex o cualquier cliente MCP a MagicSync. Investiga, redacta, programa y publica en 18 redes con aprobaciones y claves con permisos."
ogImage:
  component: BlogOgImage
  props:
    title: "Agentes de IA que Publican con MagicSync"
    description: "Conecta tu asistente de IA al programador de MagicSync"
    headline: "Tu Agente de IA, tu Calendario Social"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: MCP + API REST
  content: 15 agentes de IA compatibles
actions:
  - label: Prueba Gratis
    href: /register
    icon: "lucide:arrow-right"
  - label: Leer la Documentación
    href: /documentation
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Agente de IA conectado al programador de redes sociales MagicSync"
---
#title
Deja que tu Agente de IA <span class="gradient-text">Gestione tus Redes</span>

#description
Conecta el asistente que ya usas a MagicSync. Tu agente puede investigar, redactar, programar y publicar en 18 redes, con aprobaciones, claves con permisos y registro de auditoría.
::

::BaseBenefits
---
items:
  - title: Funciona con tu Asistente
    description: ChatGPT, Claude, Claude Code, Cursor, Codex, OpenClaw, Hermes, Grok, Muse, Perplexity, nanoclaw, Paperclip y cualquier cliente MCP.
    icon: "lucide:plug"
  - title: Una Sola Superficie de Herramientas
    description: 18 herramientas y 4 recursos por MCP para redactar, programar, gestionar medios y analítica. La API REST cubre el resto.
    icon: "lucide:wrench"
  - title: Puertas de Aprobación
    description: Los agentes redactan y encolan; una persona aprueba antes de publicar. Los permisos viven en la clave, no en el prompt.
    icon: "lucide:shield-check"
  - title: Claves de API con Permisos
    description: Claves de solo lectura o acceso completo por espacio. Revoca una al instante sin tocar el resto de tu automatización.
    icon: "lucide:key-round"
  - title: Audita Cada Llamada
    description: Cada petición se atribuye a una clave y se registra, así ves qué agente creó o cambió una publicación.
    icon: "lucide:scroll-text"
  - title: Sin Reconstruir Nada
    description: Los agentes usan el mismo calendario, biblioteca, plantillas, bandeja y analítica que la aplicación web.
    icon: "lucide:layout-grid"
---
#title
Por Qué Conectar un Agente
#subtitle
Tu asistente, conectado a un sistema real de publicación
#description
El chat sirve para ideas. Conectado a MagicSync, se convierte en un operador de redes con límites que tú controlas.
::

::BaseFeatures
---
list:
  - title: Redacta y Programa Publicaciones
    description: Convierte una conversación en una publicación en cola con ajustes por red, medios y hora de publicación.
    icon: "lucide:calendar-plus"
  - title: Investiga Tendencias y Competencia
    description: Recupera las publicaciones con mejor rendimiento, escanea tendencias y fundamenta los borradores en fuentes.
    icon: "lucide:radar"
  - title: Reutiliza en Todas las Redes
    description: Convierte un artículo, pódcast o vídeo en textos, ganchos e hilos nativos para cada plataforma.
    icon: "lucide:repeat-2"
  - title: Lee la Analítica
    description: Pregunta qué publicaciones generaron respuestas, qué red trae clics y cuándo está activa tu audiencia.
    icon: "lucide:chart-no-axes-combined"
  - title: Gestiona Medios
    description: Lista, sube y adjunta recursos de la biblioteca compartida sin salir de la conversación.
    icon: "lucide:image"
  - title: Opera el Tablero de Contenido
    description: Crea tarjetas, muévelas por investigación, redacción y revisión, y detente en la puerta de aprobación.
    icon: "lucide:kanban"
---
#title
Qué Pueden Hacer los Agentes
#subtitle
Investigar, escribir, programar, medir
#description
Cada capacidad es una herramienta con permisos, así el agente solo hace lo que permiten la clave y el espacio de negocio.
::

::BaseAgentDirectory
---
columns: 3
---
#title
Explora los 15 Agentes de IA
#description
Elige el asistente o entorno de código que ya usas. Cada guía cubre conexión, permisos y una primera publicación.
::

::BaseHowItWorks
---
type: 'vertical'
list:
  - badgeTitle: Paso 1
    title: Conecta tu Agente
    description: Apunta un cliente MCP a /mcp o crea una clave de API con permisos. Se admite OAuth y autenticación por clave.
    image: "/img/home-light.png"
  - badgeTitle: Paso 2
    title: Añade Contexto de Marca
    description: El agente lee tu perfil de negocio, playbook, plantillas y mejores publicaciones antes de redactar.
    image: "/img/home-dark.png"
  - badgeTitle: Paso 3
    title: Pide Trabajo
    description: Solicita investigación, una semana de publicaciones, un hilo, un carrusel o un resumen de analítica en lenguaje natural.
    image: "/img/home-light.png"
  - badgeTitle: Paso 4
    title: Aprueba y Publica
    description: Revisa la cola en MagicSync, aprueba lo que esté listo y deja que el programador publique a tiempo.
    image: "/img/home-dark.png"
---
#title
Cómo Funciona
#subtitle
De la conexión a la publicación
::

::BaseFaq
---
list:
  - label: ¿Qué es MCP?
    content: Model Context Protocol es un estándar abierto que permite a un cliente de IA descubrir y llamar herramientas. MagicSync expone herramientas de publicación, medios, analítica y tablero en /mcp.
    value: '1'
  - label: ¿Qué agentes son compatibles?
    content: ChatGPT, Claude, Claude Code, Codex, Cursor, OpenClaw, Hermes Agent, Grok Bot, Grok Build, Muse, Perplexity Computer, nanoclaw, Paperclip, el propio servidor MCP y la CLI de AI Agents.
    value: '2'
  - label: ¿Puede un agente publicar sin aprobación?
    content: Solo una clave de acceso completo puede publicar directamente. Las claves de solo lectura no crean ni programan, y los flujos con aprobación siempre esperan una decisión humana.
    value: '3'
  - label: ¿Necesito la API si solo uso ChatGPT?
    content: No. Conecta por MCP con OAuth o una clave. La API REST está ahí cuando quieras scripts, trabajos de CI o tu propia integración.
    value: '4'
  - label: ¿Mis datos están seguros?
    content: Los tokens y claves tienen permisos por espacio, las peticiones tienen límite de tasa, cada llamada se audita y puedes revocar una clave al instante.
    value: '5'
  - label: ¿Cuesta extra?
    content: No. MCP, la API y la CLI están incluidos en todos los planes. Solo pagas tu suscripción normal de MagicSync o auto-hospedas gratis.
    value: '6'
---
#title
Preguntas sobre Agentes
#subtitle
Conexión, permisos y qué puede hacer realmente el agente
::

::BaseCallToAction
---
title: Conecta tu Agente Hoy
description: Empieza con un asistente, un negocio y una puerta de aprobación. Añade automatización cuando confíes en los resultados.
primaryAction:
  label: Prueba Gratis
  href: /register
secondaryAction:
  label: Leer la Documentación MCP
  href: /documentation
---
::
