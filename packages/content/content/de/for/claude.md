---
layout: default
title: "Claude + MagicSync — Mach Claude zu deinem Social-Media-Operator"
description: "Verbinde den MagicSync-MCP-Server als Claude-Connector und steuere deinen Kalender im Gespräch — mit Freigabe vor jeder Veröffentlichung."
seo:
  twitterCard: summary_large_image
  twitterTitle: "Claude + MagicSync — Mach Claude zu deinem Social-Media-Operator"
  twitterDescription: "Mach Claude zu deinem Social-Media-Operator"
  ogTitle: "Claude + MagicSync — Mach Claude zu deinem Social-Media-Operator"
  ogDescription: "Mach Claude zu deinem Social-Media-Operator"
ogImage:
  component: BlogOgImage
  props:
    title: "Claude + MagicSync"
    description: "Mach Claude zu deinem Social-Media-Operator"
    headline: "KI-Agenten · Claude"
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
Claude + MagicSync

#description
Mach Claude zu deinem Social-Media-Operator. Verbinde den MagicSync-MCP-Server als Claude-Connector und steuere deinen Kalender im Gespräch — mit Freigabe vor jeder Veröffentlichung.
::

::AgentConnect
---
agent: "claude"
tagline: "Mach Claude zu deinem Social-Media-Operator. Verbinde den MagicSync-MCP-Server als Claude-Connector und steuere deinen Kalender im Gespräch — mit Freigabe vor jeder Veröffentlichung."
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
Was Claude mit MagicSync kann
#description
Alles, was dein Agent zum Planen, Veröffentlichen und Nachweisen braucht.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "Wie verbinde ich Claude mit MagicSync?"
    content: "MCP-Endpunkt kopieren, in Claude als eigenen MCP-Connector eintragen und den Zugriff über dein MagicSync-Konto bestätigen. Bei OAuth ist kein API-Key nötig."
    value: '1'
  - label: "Brauche ich einen API-Key?"
    content: "Nicht für OAuth-fähige MCP-Clients. Headless-Skripte nutzen einen eingeschränkten API-Key aus „API Keys“."
    value: '2'
  - label: "Sieht Claude meine Social-Media-Passwörter?"
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
agent: "claude"
---
::

::BaseCallToAction
---
title: "Lass Claude deine Social Media übernehmen"
description: "MagicSync einmal verbinden und dieselben Konten, Freigaben, Kalender und Analysen weiter nutzen."
primaryAction:
  label: "Kostenlos starten"
  href: /register
secondaryAction:
  label: "MCP-Dokumentation"
  href: /guide/mcp
---
::
