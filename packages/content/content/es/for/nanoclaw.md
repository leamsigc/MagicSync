---
layout: default
title: "nanoclaw + MagicSync — Publica desde WhatsApp o Telegram"
description: "nanoclaw ejecuta un agente en tus apps de chat; conéctalo al MCP de MagicSync y aprueba posts desde la conversación."
seo:
  twitterCard: summary_large_image
  twitterTitle: "nanoclaw + MagicSync — Publica desde WhatsApp o Telegram"
  twitterDescription: "Publica desde WhatsApp o Telegram"
  ogTitle: "nanoclaw + MagicSync — Publica desde WhatsApp o Telegram"
  ogDescription: "Publica desde WhatsApp o Telegram"
ogImage:
  component: BlogOgImage
  props:
    title: "nanoclaw + MagicSync"
    description: "Publica desde WhatsApp o Telegram"
    headline: "Agentes de IA · nanoclaw"
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
nanoclaw + MagicSync

#description
Publica desde WhatsApp o Telegram. nanoclaw ejecuta un agente en tus apps de chat; conéctalo al MCP de MagicSync y aprueba posts desde la conversación.
::

::AgentConnect
---
agent: "nanoclaw"
tagline: "Publica desde WhatsApp o Telegram. nanoclaw ejecuta un agente en tus apps de chat; conéctalo al MCP de MagicSync y aprueba posts desde la conversación."
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
Qué puede hacer nanoclaw con MagicSync
#description
Todo lo que tu agente necesita para planificar, publicar y responder.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "¿Cómo conecto nanoclaw a MagicSync?"
    content: "Copia el endpoint MCP de MagicSync, añádelo a nanoclaw como conector MCP personalizado y aprueba el acceso con tu cuenta. Con OAuth no hace falta API key."
    value: '1'
  - label: "¿Necesito una API key?"
    content: "No para clientes MCP con OAuth. Los scripts y cron usan una API key con permisos creada en API Keys."
    value: '2'
  - label: "¿nanoclaw ve mis contraseñas de redes sociales?"
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
agent: "nanoclaw"
---
::

::BaseCallToAction
---
title: "Deja que nanoclaw lleve tus redes"
description: "Conecta MagicSync una vez y mantén las mismas cuentas, aprobaciones, calendario y analíticas."
primaryAction:
  label: "Empezar gratis"
  href: /register
secondaryAction:
  label: "Documentación MCP"
  href: /guide/mcp
---
::
