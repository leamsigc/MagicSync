---
layout: default
title: "Soporte: Ayuda con MagicSync"
description: "Obtén ayuda con MagicSync: solución de publicaciones fallidas, conexión de cuentas, facturación y despliegues auto-hospedados. La vía más rápida a una respuesta."
head:
  htmlAttrs:
    lang: es
  meta:
    - name: keywords
      content: "soporte MagicSync, ayuda programador de redes, publicación programada fallida, reconectar cuenta social, ayuda facturación"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Equipo MagicSync"
    - name: description
      content: "Obtén ayuda con MagicSync: solución de publicaciones fallidas, conexión de cuentas, facturación y despliegues auto-hospedados. La vía más rápida a una respuesta."
ogImage:
  component: BlogOgImage
  props:
    title: "Soporte de MagicSync"
    description: "Solución de problemas, documentación y ayuda directa"
    headline: "Ayuda Cuando la Necesitas"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Soporte
  content: Respuestas reales, sin laberintos
actions:
  - label: Escribir a Soporte
    href: mailto:MagicSync@leamsigc.com
    icon: "lucide:mail"
  - label: Ver el Estado
    href: /status
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Soporte y solución de problemas de MagicSync"
---
#title
Ayuda Cuando la <span class="gradient-text">Necesitas</span>

#description
Empieza con las respuestas de autoayuda de abajo. Si no lo resuelven, escríbenos con el ID de publicación, la plataforma y la hora, y rastrearemos el intento exacto de publicación.
::

::BaseFeatures
---
list:
  - title: Documentación
    description: Guías de instalación, conexiones, programación, API y auto-hospedaje, todo buscable y basado en tareas.
    icon: "lucide:book-open"
  - title: Página de Estado
    description: Comprueba si una caída o un problema de API de la plataforma explica el comportamiento antes de depurar tu configuración.
    icon: "lucide:activity"
  - title: Guías y Blog
    description: Tutoriales paso a paso para flujos comunes, desde la primera semana de programación hasta importaciones masivas y reutilización con IA.
    icon: "lucide:newspaper"
  - title: Soporte por Email
    description: Para problemas específicos de cuenta, envía el ID de publicación, la plataforma y la hora aproximada para correlacionar los registros.
    icon: "lucide:mail"
---
#title
Encuentra la Vía Más Rápida a una Respuesta
#subtitle
Lo que puedes hacer con MagicSync
#description
La mayoría de los problemas entran en cuatro grupos. Empieza por la solución que corresponda.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Una publicación no se publicó

Abre la publicación y lee el error por plataforma. Las tres causas más comunes son un token caducado, un permiso ausente y un formato de medio no compatible. Reconecta la cuenta desde la pantalla de integraciones y reintenta solo la plataforma fallida. Las que ya publicaron se omiten, así no creas duplicados.

## Una cuenta no conecta

Comprueba que has iniciado sesión con el perfil correcto de la plataforma en el mismo navegador, que la cuenta tiene el rol de administrador necesario y que las ventanas emergentes no están bloqueadas durante la autorización. Para páginas de Facebook y páginas de empresa de LinkedIn, el perfil personal que aprueba el acceso debe ser administrador de la página.

## Facturación o dudas de plan

Los cambios de plan, las facturas y la cancelación están en la [página de facturación](/es/app/billing). Si un pago se completó pero el plan no se actualizó, incluye el ID de factura y el email de la cuenta al contactarnos.

## Problemas de despliegue auto-hospedado

Revisa primero los registros del contenedor y el endpoint de salud. La mayoría de primeros arranques fallidos vienen de variables de entorno ausentes, una base de datos sin migrar o una URL pública que no coincide con el callback de autenticación configurado.

## Qué incluir en un email de soporte

- El email de tu cuenta.
- El ID de publicación o la cuenta que intentabas conectar.
- La plataforma y la hora aproximada en tu zona horaria.
- El texto exacto del error o una captura.
- Si el problema ocurre siempre o solo una vez.

</section>

::BaseFaq
---
list:
  - label: ¿Qué tan rápido responde el soporte?
    content: Los clientes Pro y Enterprise reciben soporte prioritario por email, normalmente en un día laborable. Los usuarios auto-hospedados tienen soporte de la comunidad en GitHub.
    value: '1'
  - label: ¿Ofrecen soporte telefónico?
    content: El email es el canal principal porque mantiene el ID, las capturas y los registros en un mismo hilo. Los acuerdos Enterprise pueden incluir llamadas programadas.
    value: '2'
  - label: ¿Pueden publicar un post por mí?
    content: Podemos diagnosticar por qué falló una publicación, pero no publicamos en tu nombre. Así la aprobación y el control de la cuenta siguen contigo.
    value: '3'
  - label: Encontré un problema de seguridad. ¿Dónde lo reporto?
    content: Escríbenos con el asunto Seguridad y suficiente detalle para reproducirlo. No publiques detalles de explotación antes de que respondamos.
    value: '4'
  - label: ¿El soporte cubre cambios de políticas de las plataformas?
    content: Explicamos cómo gestiona MagicSync los cambios de API, pero las suspensiones y decisiones de política son entre tú y la plataforma.
    value: '5'
  - label: ¿Dónde puedo solicitar una función?
    content: Abre un issue en GitHub o envíalo por soporte. Incluye el flujo que intentas completar, no solo el botón que quieres.
    value: '6'
---

#title
Preguntas sobre Soporte
#subtitle
Tiempos de respuesta, alcance y cómo obtener una respuesta útil rápido.
::

::BaseCallToAction
---
title: Envíanos los Detalles
description: Con el ID de publicación, la plataforma y la hora podemos rastrear la mayoría de problemas de publicación.
primaryAction:
  label: Escribir a Soporte
  href: mailto:MagicSync@leamsigc.com
secondaryAction:
  label: Leer la Documentación
  href: /documentation
---
::
