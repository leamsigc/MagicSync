---
layout: default
title: "Paperclip + MagicSync — Social Publishing für deine Agentur aus Agenten"
description: "Gib deinem Paperclip-Team einen MagicSync-Platz: ein Agent führt den Kalender, die anderen entwerfen und prüfen vorab."
seo:
  twitterCard: summary_large_image
  twitterTitle: "Paperclip + MagicSync — Social Publishing für deine Agentur aus Agenten"
  twitterDescription: "Social Publishing für deine Agentur aus Agenten"
  ogTitle: "Paperclip + MagicSync — Social Publishing für deine Agentur aus Agenten"
  ogDescription: "Social Publishing für deine Agentur aus Agenten"
ogImage:
  component: BlogOgImage
  props:
    title: "Paperclip + MagicSync"
    description: "Social Publishing für deine Agentur aus Agenten"
    headline: "KI-Agenten · Paperclip"
    imageUrl: "/img/home-dark.png"
head:
  htmlAttrs:
    lang: de
---

::BaseHero
---
badge:
  label: "KI-Agenten"
  content: "MagicSync MCP"
actions:
  - label: "Kostenlos starten"
    href: /register
    icon: "lucide:arrow-right"
  - label: "MCP-Dokumentation"
    href: /guide/mcp
    variant: outline
showHeroImage: false
---
#title
Paperclip + MagicSync

#description
Social Publishing für deine Agentur aus Agenten. Gib deinem Paperclip-Team einen MagicSync-Platz: ein Agent führt den Kalender, die anderen entwerfen und prüfen vorab.
::

::AgentConnect
---
agent: "paperclip"
tagline: "Social Publishing für deine Agentur aus Agenten. Gib deinem Paperclip-Team einen MagicSync-Platz: ein Agent führt den Kalender, die anderen entwerfen und prüfen vorab."
---
::

::BaseFeatures
---
list:
  - title: "Agent-native Veröffentlichung"
    description: "In natürlicher Sprache fragen. MagicSync macht daraus Entwürfe, geplante Beiträge und plattformgerechtes Format."
    icon: "lucide:bot"
  - title: "Ein Kalender für alle Kanäle"
    description: "Instagram, X, LinkedIn, Facebook, Threads, TikTok, YouTube, Bluesky, Pinterest, Reddit, WordPress und mehr — eine Warteschlange."
    icon: "lucide:calendar-check"
  - title: "Freigaben und Audit-Log"
    description: "Jeder Tool-Aufruf wird protokolliert. Veröffentlichen wartet auf deine Freigabe, bis du Vollzugriff gibst."
    icon: "lucide:shield-check"
  - title: "Über 18 Plattformen"
    description: "Dieselben verbundenen Konten wie in MagicSync, mit Limits und Vorschauen."
    icon: "lucide:share-2"
---
#title
Was Paperclip mit MagicSync kann
#description
Alles, was dein Agent zum Planen, Veröffentlichen und Nachweisen braucht.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "Wie verbinde ich Paperclip mit MagicSync?"
    content: "MCP-Endpunkt kopieren, in Paperclip als eigenen MCP-Connector eintragen und den Zugriff über dein MagicSync-Konto bestätigen. Bei OAuth ist kein API-Key nötig."
    value: '1'
  - label: "Brauche ich einen API-Key?"
    content: "Nicht für OAuth-fähige MCP-Clients. Headless-Skripte nutzen einen eingeschränkten API-Key aus „API Keys“."
    value: '2'
  - label: "Sieht Paperclip meine Social-Media-Passwörter?"
    content: "Nein. MagicSync speichert die Tokens und stellt Tools über MCP bereit. Der Agent erhält nur Ergebnisse, keine Zugangsdaten."
    value: '3'
  - label: "Veröffentlicht es ohne meine Freigabe?"
    content: "Schreibvorgänge sind standardmäßig freigabepflichtig. Du kannst jede Veröffentlichung bestätigen oder Vollzugriff geben."
    value: '4'
  - label: "Ist MagicSync kostenlos?"
    content: "Ja. Selbst hosten kostenlos oder gehosteter Plan mit Analytik und Team."
    value: '5'
---
#title
Häufige Fragen
#description
Kurze Antworten zu Verbindung, Zugriff und Veröffentlichung.
::

::AgentOtherAgents
---
agent: "paperclip"
---
::

::BaseCallToAction
---
title: "Lass Paperclip deine Social Media übernehmen"
description: "MagicSync einmal verbinden und dieselben Konten, Freigaben, Kalender und Analysen weiter nutzen."
primaryAction:
  label: "Kostenlos starten"
  href: /register
secondaryAction:
  label: "MCP-Dokumentation"
  href: /guide/mcp
---
::
