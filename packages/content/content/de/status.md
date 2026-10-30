---
layout: default
title: "MagicSync Status: Verfügbarkeit der Plattform"
description: "Aktueller Betriebsstatus für Web-App, API, Planer, Publishing-Worker, KI-Dienste und Content-Auslieferung von MagicSync sowie den Umgang mit Störungen."
head:
  htmlAttrs:
    lang: de
  meta:
    - name: keywords
      content: "MagicSync Status, Verfügbarkeit, Ausfall, API, fehlgeschlagener Beitrag, Plattformstatus"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Aktueller Betriebsstatus für Web-App, API, Planer, Publishing-Worker, KI-Dienste und Content-Auslieferung von MagicSync sowie den Umgang mit Störungen."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Plattform-Status"
    description: "Serviceverfügbarkeit und Störungsmanagement"
    headline: "Live-Plattformstatus"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Alle Systeme
  content: Kerndienste betriebsbereit
actions:
  - label: Problem Melden
    href: /support
    icon: "lucide:arrow-right"
  - label: Changelog Ansehen
    href: /changelog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Status-Dashboard der MagicSync-Dienste"
---
#title
<span class="gradient-text">Live-Plattformstatus</span>

#description
Der schnellste Weg festzustellen, ob das Problem bei uns liegt. Während einer Störung wird diese Seite zuerst aktualisiert, bevor sich die Support-Warteschlangen füllen.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Status der Verwalteten Cloud

| Dienst | Status | Umfang |
|---|---|---|
| Web-Anwendung | Betriebsbereit | Anmeldung, Dashboard, Kalender, Editor |
| Öffentliche API | Betriebsbereit | Anfragen an `/api/v1/*` und API-Key-Zugriff |
| Planer | Betriebsbereit | Versand geplanter und zeitgesteuerter Beiträge |
| Publishing-Worker | Betriebsbereit | Auslieferung an verbundene soziale Netzwerke |
| KI-Dienste | Betriebsbereit | Texte, Hooks und Wiederverwertung |
| Medien und Uploads | Betriebsbereit | Upload, Speicherung und Auslieferung |
| MCP und Agenten | Betriebsbereit | `/mcp`-Tools, Chatsitzungen und Content-Board |

**Zuletzt geprüft:** Oktober 2026. Die verwaltete Cloud strebt 99,9 % monatliche Verfügbarkeit für Web-App, API und Planer an.

## Wenn ein Geplanter Beitrag Nicht Erschienen Ist

1. Öffne den Beitrag und lies den Fehler pro Plattform. Die meisten Fehler kommen von einem abgelaufenen Token, einer fehlenden Berechtigung oder einem abgelehnten Medienformat.
2. Verbinde das betroffene Konto im Integrationsbildschirm neu.
3. Wiederhole nur die fehlgeschlagene Plattform. MagicSync überspringt bereits veröffentlichte Plattformen, damit Follower keine Duplikate sehen.

## Self-Hosted-Installationen

Wenn du die Docker-Edition betreibst, hängt deine Verfügbarkeit von deiner Infrastruktur ab. Nutze den Health-Endpoint in deinem Monitoring und betrachte diese Seite als Referenz für vorgelagerte Social-APIs, nicht als Bericht über deinen Server.

## Wie Störungen Behandelt Werden

Eine Störung gilt als **beeinträchtigt**, wenn das Veröffentlichen verzögert, aber eingereiht wird, und als **Ausfall**, wenn neue Beiträge nicht eingereiht oder zugestellt werden können. Während eines Ausfalls priorisiert der Support zeitkritische Beiträge, und betroffene Zeitpläne werden nach Wiederherstellung automatisch erneut versucht.

</section>

::BaseFaq
---
list:
  - label: Überwacht Diese Seite Meine Self-Hosted-Installation?
    content: Nein. Sie berichtet über die verwaltete MagicSync-Cloud. Deine Installation hat eigene Logs und Health-Checks.
    value: '1'
  - label: Wie Oft Wird der Status Aktualisiert?
    content: Zu Beginn und Ende jeder Störung sowie mindestens alle 30 Minuten, solange eine Störung aktiv ist.
    value: '2'
  - label: Werden Verpasste Beiträge Nach einem Ausfall Automatisch Veröffentlicht?
    content: Eingereihte Beiträge werden nach Wiederherstellung erneut versucht. Beiträge, deren Zeitfenster vollständig vorbei ist, werden zur Prüfung markiert statt Stunden später zu erscheinen.
    value: '3'
  - label: Wo Melde Ich ein Problem, Das Hier Nicht Steht?
    content: Melde es über die Supportseite mit Beitrags-ID, Plattform und ungefährer Uhrzeit. So können wir es schnell mit den Serverlogs abgleichen.
    value: '4'
---

#title
FAQ zum Status
#subtitle
Wie du diese Seite liest und was zu tun ist, wenn etwas falsch aussieht.
::

::BaseCallToAction
---
title: Siehst Du Weiterhin ein Problem?
description: Sende uns Beitrags-ID und Plattform. Wir verfolgen es in den Publishing-Logs.
primaryAction:
  label: Support Kontaktieren
  href: /support
secondaryAction:
  label: Leitfäden Lesen
  href: /guides
---
::
