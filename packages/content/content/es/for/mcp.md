---
layout: default
title: "MCP Server + MagicSync — Un endpoint MCP para cualquier cliente de IA"
description: "MagicSync expone 18 herramientas y 4 recursos por MCP, con OAuth o API keys, permisos de solo lectura o totales y auditoría en cada llamada."
seo:
  twitterCard: summary_large_image
  twitterTitle: "MCP Server + MagicSync — Un endpoint MCP para cualquier cliente de IA"
  twitterDescription: "Un endpoint MCP para cualquier cliente de IA"
  ogTitle: "MCP Server + MagicSync — Un endpoint MCP para cualquier cliente de IA"
  ogDescription: "Un endpoint MCP para cualquier cliente de IA"
ogImage:
  component: BlogOgImage
  props:
    title: "MCP Server + MagicSync"
    description: "Un endpoint MCP para cualquier cliente de IA"
    headline: "Agentes de IA · MCP Server"
    imageUrl: "/img/home-dark.png"
head:
  htmlAttrs:
    lang: es
---

::BaseHero
---
badge:
  label: "Agentes de IA"
  content: "MagicSync MCP"
actions:
  - label: "Empezar gratis"
    href: /register
    icon: "lucide:arrow-right"
  - label: "Documentación MCP"
    href: /guide/mcp
    variant: outline
showHeroImage: false
---
#title
MCP Server + MagicSync

#description
Un endpoint MCP para cualquier cliente de IA. MagicSync expone 18 herramientas y 4 recursos por MCP, con OAuth o API keys, permisos de solo lectura o totales y auditoría en cada llamada.
::

::AgentConnect
---
agent: "mcp"
tagline: "Un endpoint MCP para cualquier cliente de IA. MagicSync expone 18 herramientas y 4 recursos por MCP, con OAuth o API keys, permisos de solo lectura o totales y auditoría en cada llamada."
---
::

::BaseFeatures
---
list:
  - title: "Publicación nativa para agentes"
    description: "Pide en lenguaje natural. MagicSync convierte la petición en borradores, posts programados y formato por plataforma."
    icon: "lucide:bot"
  - title: "Un calendario para todos los canales"
    description: "Instagram, X, LinkedIn, Facebook, Threads, TikTok, YouTube, Bluesky, Pinterest, Reddit, WordPress y más — una sola cola."
    icon: "lucide:calendar-check"
  - title: "Aprobaciones y auditoría"
    description: "Cada llamada queda registrada. Publicar espera tu aprobación hasta que des acceso total."
    icon: "lucide:shield-check"
  - title: "Más de 18 plataformas"
    description: "Las mismas cuentas conectadas que ya usas en MagicSync, con sus límites y vistas previas."
    icon: "lucide:share-2"
---
#title
Qué puede hacer MCP Server con MagicSync
#description
Todo lo que tu agente necesita para planificar, publicar y responder.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "¿Cómo conecto MCP Server a MagicSync?"
    content: "Copia el endpoint MCP de MagicSync, añádelo a MCP Server como conector MCP personalizado y aprueba el acceso con tu cuenta. Con OAuth no hace falta API key."
    value: '1'
  - label: "¿Necesito una API key?"
    content: "No para clientes MCP con OAuth. Los scripts y cron usan una API key con permisos creada en API Keys."
    value: '2'
  - label: "¿MCP Server ve mis contraseñas de redes sociales?"
    content: "No. MagicSync guarda los tokens y expone herramientas por MCP. El agente solo recibe resultados, nunca tus credenciales."
    value: '3'
  - label: "¿Publicará sin mi aprobación?"
    content: "Las escrituras están bloqueadas por defecto. Puedes exigir aprobación en cada publicación o dar acceso total."
    value: '4'
  - label: "¿MagicSync es gratis para empezar?"
    content: "Sí. Autoalojado gratis o plan gestionado con analíticas y equipo."
    value: '5'
---
#title
Preguntas frecuentes
#description
Respuestas cortas sobre la conexión, el acceso y la publicación.
::

::AgentOtherAgents
---
agent: "mcp"
---
::

::BaseCallToAction
---
title: "Deja que MCP Server lleve tus redes"
description: "Conecta MagicSync una vez y mantén las mismas cuentas, aprobaciones, calendario y analíticas."
primaryAction:
  label: "Empezar gratis"
  href: /register
secondaryAction:
  label: "Documentación MCP"
  href: /guide/mcp
---
::
