---
layout: default
title: "MagicSync Changelog: Neueste Produktupdates"
description: "Verfolge, was in MagicSync erscheint: Kalenderverbesserungen, Content-Board, Abrechnung, Sicherheit, neue Integrationen und Performance-Arbeit."
head:
  htmlAttrs:
    lang: de
  meta:
    - name: keywords
      content: "MagicSync Changelog, Produktupdates, Release Notes, neue Funktionen, MagicSync Updates"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Verfolge, was in MagicSync erscheint: Kalenderverbesserungen, Content-Board, Abrechnung, Sicherheit, neue Integrationen und Performance-Arbeit."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Changelog"
    description: "Produktupdates, Fehlerbehebungen und Verbesserungen"
    headline: "Sieh, Was Neu Ist in MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Changelog
  content: Veröffentlicht, nicht versprochen
actions:
  - label: Release Notes Lesen
    href: /release-notes
    icon: "lucide:arrow-right"
  - label: Blog Ansehen
    href: /blog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync Changelog und Release-Zeitleiste"
---
#title
Sieh, Was <span class="gradient-text">Neu Ist in MagicSync</span>

#description
Eine laufende Aufzeichnung relevanter Änderungen: neue Workflows, Sicherheitsfixes, Performance-Arbeit und Integrationen. Kleine Textkorrekturen bleiben draußen, alles was deinen Tag betrifft nicht.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Oktober 2026

### Kalender auf Nuxt UI Neu Gebaut
Der alte Kalender wurde durch einen nativen Tages-, Wochen- und Monatskalender ersetzt. Ausstehende Beiträge lassen sich per Drag and Drop verschieben, Plattformvorschauen folgen dem Drop und Kalender sind pro Unternehmen teilbar.

### Gemeinsame Sammlungsansichten
Unternehmen, Integrationen und andere Verzeichnisse teilen sich ein Sammlungssystem mit Ansichtswechsel, Suche, Filtern und Sortieren. Weniger inkonsistente Bildschirme, schnellere Navigation.

### Content-Board, Profil und Abrechnung
Inhaltskarten verhalten sich wie Aufgabenkarten mit Status-Chips, Prioritäten, relativen Daten und Kontextmenüs. Die Abrechnung erhielt Plan-, Zahlungs- und Rechnungsansichten über Stripe, und das Profil wurde zur einzigen Kontoansicht.

### Snapchat- und dev-null.sh-Verbindungen
Snapchat kam über einen offiziellen OAuth-Anbieter hinzu, dazu eine dev-null.sh-Veröffentlichungsverbindung, jeweils mit Einrichtungsanleitung.

### Sicherheit und API-Performance
Die API löst die Sitzung einmal pro Anfrage auf, aktiviert einen kurzen Session-Cookie-Cache, härtet ausgehende Aufrufe gegen SSRF, verschlüsselt Social-Tokens im Ruhezustand und ergänzt Rate-Limits sowie strengere Security-Header.

### YouTube-Metadaten und Teilweises Wiederholen
YouTube-Uploads leiten Titel und Tags aus dem Beitragsinhalt ab, und ein erneuter Versuch veröffentlicht bereits erfolgreiche Plattformen nicht noch einmal.

## September 2026

### Agentenplattform und Content-Board
Die In-Process-Agentenlaufzeit, das Content-Board pro Unternehmen, Trend-Scans, SEO/GEO-Prüfungen und freigabegesteuertes Veröffentlichen wanderten ins Hauptprodukt.

## August 2026

### Self-Hosted-Deployment
Der Docker-Deploymentpfad mit Non-Root-Container, dokumentierten Umgebungsvariablen und geführter Ersteinrichtung wurde veröffentlicht.

</section>

::BaseFeatures
---
list:
  - title: Release-Rhythmus
    description: Fixes erscheinen kontinuierlich; größere Funktionen kommen in thematischen Wellen, damit Dokumentation und Screenshots aktuell bleiben.
    icon: "lucide:rocket"
  - title: Abwärtskompatibilität
    description: Bestehende geplante Beiträge werden weiter veröffentlicht, wenn sich Interna ändern. Abschaltungen werden vorher angekündigt.
    icon: "lucide:shield-check"
  - title: Öffentliche Roadmap-Signale
    description: Blogbeiträge erklären die Gründe hinter größeren Änderungen, einschließlich der akzeptierten Kompromisse.
    icon: "lucide:map"
---
#title
Wie Wir Veröffentlichen
#subtitle
Was du mit MagicSync machen kannst
#description
Ein verlässlicher Rhythmus ist besser als ein Überraschungs-Release, das niemand einplanen kann.
::

::BaseCallToAction
---
title: Willst Du die Details Hinter einer Änderung?
description: Ausführliche Release Notes und Architekturbeiträge findest du im Blog und in der Dokumentation.
primaryAction:
  label: Release Notes Lesen
  href: /release-notes
secondaryAction:
  label: Blog Ansehen
  href: /blog
---
::
