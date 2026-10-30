---
layout: default
title: "Perplexity Computer + MagicSync — Recherchieren und veröffentlichen in einem Lauf"
description: "Perplexity Computer recherchiert ein Thema und übergibt das Ergebnis per MCP an MagicSync — inklusive Quellen."
seo:
  twitterCard: summary_large_image
  twitterTitle: "Perplexity Computer + MagicSync — Recherchieren und veröffentlichen in einem Lauf"
  twitterDescription: "Recherchieren und veröffentlichen in einem Lauf"
  ogTitle: "Perplexity Computer + MagicSync — Recherchieren und veröffentlichen in einem Lauf"
  ogDescription: "Recherchieren und veröffentlichen in einem Lauf"
ogImage:
  component: BlogOgImage
  props:
    title: "Perplexity Computer + MagicSync"
    description: "Recherchieren und veröffentlichen in einem Lauf"
    headline: "KI-Agenten · Perplexity Computer"
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
Perplexity Computer + MagicSync

#description
Recherchieren und veröffentlichen in einem Lauf. Perplexity Computer recherchiert ein Thema und übergibt das Ergebnis per MCP an MagicSync — inklusive Quellen.
::

::AgentConnect
---
agent: "perplexity-computer"
tagline: "Recherchieren und veröffentlichen in einem Lauf. Perplexity Computer recherchiert ein Thema und übergibt das Ergebnis per MCP an MagicSync — inklusive Quellen."
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
Was Perplexity Computer mit MagicSync kann
#description
Alles, was dein Agent zum Planen, Veröffentlichen und Nachweisen braucht.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "Wie verbinde ich Perplexity Computer mit MagicSync?"
    content: "MCP-Endpunkt kopieren, in Perplexity Computer als eigenen MCP-Connector eintragen und den Zugriff über dein MagicSync-Konto bestätigen. Bei OAuth ist kein API-Key nötig."
    value: '1'
  - label: "Brauche ich einen API-Key?"
    content: "Nicht für OAuth-fähige MCP-Clients. Headless-Skripte nutzen einen eingeschränkten API-Key aus „API Keys“."
    value: '2'
  - label: "Sieht Perplexity Computer meine Social-Media-Passwörter?"
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
agent: "perplexity-computer"
---
::

::BaseCallToAction
---
title: "Lass Perplexity Computer deine Social Media übernehmen"
description: "MagicSync einmal verbinden und dieselben Konten, Freigaben, Kalender und Analysen weiter nutzen."
primaryAction:
  label: "Kostenlos starten"
  href: /register
secondaryAction:
  label: "MCP-Dokumentation"
  href: /guide/mcp
---
::
