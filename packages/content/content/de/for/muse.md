---
layout: default
title: "Muse + MagicSync — Eine Nachricht, eine Woche Beiträge"
description: "Füge den MagicSync-MCP-Link in Muse ein und bitte um eine Woche Content — Planung, Texte und Einplanung in deinem Konto."
seo:
  twitterCard: summary_large_image
  twitterTitle: "Muse + MagicSync — Eine Nachricht, eine Woche Beiträge"
  twitterDescription: "Eine Nachricht, eine Woche Beiträge"
  ogTitle: "Muse + MagicSync — Eine Nachricht, eine Woche Beiträge"
  ogDescription: "Eine Nachricht, eine Woche Beiträge"
ogImage:
  component: BlogOgImage
  props:
    title: "Muse + MagicSync"
    description: "Eine Nachricht, eine Woche Beiträge"
    headline: "KI-Agenten · Muse"
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
Muse + MagicSync

#description
Eine Nachricht, eine Woche Beiträge. Füge den MagicSync-MCP-Link in Muse ein und bitte um eine Woche Content — Planung, Texte und Einplanung in deinem Konto.
::

::AgentConnect
---
agent: "muse"
tagline: "Eine Nachricht, eine Woche Beiträge. Füge den MagicSync-MCP-Link in Muse ein und bitte um eine Woche Content — Planung, Texte und Einplanung in deinem Konto."
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
Was Muse mit MagicSync kann
#description
Alles, was dein Agent zum Planen, Veröffentlichen und Nachweisen braucht.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "Wie verbinde ich Muse mit MagicSync?"
    content: "MCP-Endpunkt kopieren, in Muse als eigenen MCP-Connector eintragen und den Zugriff über dein MagicSync-Konto bestätigen. Bei OAuth ist kein API-Key nötig."
    value: '1'
  - label: "Brauche ich einen API-Key?"
    content: "Nicht für OAuth-fähige MCP-Clients. Headless-Skripte nutzen einen eingeschränkten API-Key aus „API Keys“."
    value: '2'
  - label: "Sieht Muse meine Social-Media-Passwörter?"
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
agent: "muse"
---
::

::BaseCallToAction
---
title: "Lass Muse deine Social Media übernehmen"
description: "MagicSync einmal verbinden und dieselben Konten, Freigaben, Kalender und Analysen weiter nutzen."
primaryAction:
  label: "Kostenlos starten"
  href: /register
secondaryAction:
  label: "MCP-Dokumentation"
  href: /guide/mcp
---
::
