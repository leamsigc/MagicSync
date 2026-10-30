---
layout: default
title: "Documentación: Instalar, Configurar y Ampliar | MagicSync"
description: "Documentación de MagicSync para instalación, conexiones, programación, agentes de IA, claves de API, MCP y despliegue auto-hospedado con Docker."
head:
  htmlAttrs:
    lang: es
  meta:
    - name: keywords
      content: "documentación MagicSync, instalar programador de redes sociales, despliegue Docker, auto-hospedaje, servidor MCP, claves de API"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Equipo MagicSync"
    - name: description
      content: "Documentación de MagicSync para instalación, conexiones, programación, agentes de IA, claves de API, MCP y despliegue auto-hospedado con Docker."
ogImage:
  component: BlogOgImage
  props:
    title: "Documentación de MagicSync"
    description: "Guías de instalación, configuración, API y auto-hospedaje"
    headline: "Todo lo que Necesitas para Usar MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Documentación
  content: Del primer acceso al auto-hospedaje
actions:
  - label: Abrir la Documentación
    href: https://leamsigc.github.io/MagicSync/
    icon: "lucide:arrow-right"
  - label: Referencia de API
    href: /api-reference
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Sitio de documentación de MagicSync"
---
#title
Todo lo que Necesitas para <span class="gradient-text">Usar MagicSync</span>

#description
Guías breves basadas en tareas, no un muro de texto de referencia. Encuentra lo que necesitas hacer, sigue los pasos y vuelve a publicar.
::

::BaseFeatures
---
list:
  - title: Primeros Pasos
    description: Crea un espacio, añade el perfil de tu negocio y programa tu primera publicación. La lista guiada cubre los tres pasos de configuración.
    icon: "lucide:rocket"
  - title: Conexiones de Plataformas
    description: Notas de configuración por red para Facebook, Instagram, X, LinkedIn, Pinterest, Google Business Profile, TikTok, YouTube y más.
    icon: "lucide:plug"
  - title: Programación y Calendario
    description: Aprende el compositor, los ajustes por plataforma, la reprogramación con arrastrar y soltar y cómo maneja el calendario las zonas horarias.
    icon: "lucide:calendar-days"
  - title: IA y Agentes
    description: Configura proveedores, escribe un playbook de marca, usa el tablero de contenido y entiende las puertas de aprobación antes de publicar.
    icon: "lucide:sparkles"
  - title: API, CLI y MCP
    description: Crea claves de API, llama a la API REST, automatiza operaciones masivas y conecta Claude u otro asistente mediante MCP.
    icon: "lucide:terminal"
  - title: Auto-Hospedaje
    description: Despliegue con Docker, variables de entorno, migraciones de base de datos, copias de seguridad y ruta de actualización entre versiones.
    icon: "lucide:server"
---
#title
Guías Organizadas por Tarea
#subtitle
Lo que puedes hacer con MagicSync
#description
No hace falta leer el manual completo. Ve directo al flujo que estás configurando.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Inicio rápido

1. **Crea tu cuenta** en [registro](/es/register) o despliega la edición auto-hospedada.
2. **Crea un negocio** y completa la audiencia, los servicios y el tono de voz.
3. **Conecta una red** desde la pantalla de integraciones y aprueba los permisos solicitados.
4. **Programa tu primera publicación** desde el compositor y confírmala en el calendario.
5. **Invita a tu equipo** si otra persona debe revisar o responder mensajes.

## Auto-hospedaje en resumen

```bash
git clone https://github.com/leamsigc/MagicSync.git
cd MagicSync
docker compose up -d
```

Configura las variables de entorno para tu URL pública, el secreto de autenticación y las credenciales de los proveedores sociales, luego ejecuta las migraciones de base de datos. La referencia completa de variables y las notas de actualización están en el sitio de documentación.

## A dónde ir después

- [Referencia de API](/es/api-reference) para grupos de endpoints, autenticación y permisos.
- [Guías](/es/guides) para flujos de marketing paso a paso.
- [Changelog](/es/changelog) para saber qué cambió entre versiones.
- [Blog](/es/blog) para artículos más largos de ingeniería y estrategia.

</section>

::BaseFaq
---
list:
  - label: ¿Necesito leer la documentación para usar la versión en la nube?
    content: No. La incorporación guiada cubre los tres pasos esenciales. La documentación está ahí cuando quieras configurar algo avanzado.
    value: '1'
  - label: ¿Dónde encuentro la lista completa de variables de entorno?
    content: La sección de auto-hospedaje de la documentación lista cada variable, cuáles son obligatorias y los valores seguros para desarrollo local.
    value: '2'
  - label: ¿La documentación está en otros idiomas?
    content: Las páginas de marketing están localizadas. La documentación técnica se mantiene primero en inglés, con guías traducidas a medida que se escriben.
    value: '3'
  - label: ¿Cómo reporto documentación desactualizada?
    content: Abre un issue en GitHub o envíalo desde la página de soporte con el título de la página y qué cambió.
    value: '4'
---

#title
Preguntas sobre Documentación
#subtitle
Dónde mirar cuando el inicio rápido no es suficiente.
::

::BaseCallToAction
---
title: ¿Listo para Construir tu Flujo?
description: Empieza con la guía de inicio rápido y automatiza todo lo que siga siendo repetitivo.
primaryAction:
  label: Abrir Documentación
  href: https://leamsigc.github.io/MagicSync/
secondaryAction:
  label: Leer la API
  href: /api-reference
---
::
