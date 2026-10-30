---
layout: default
title: "Dokumentation: Installieren und Erweitern | MagicSync"
description: "MagicSync-Dokumentation für Einrichtung, Plattformverbindungen, Planung, KI-Agenten, API-Keys, MCP und Docker-Self-Hosting. Starte mit dem Schnellstart."
head:
  htmlAttrs:
    lang: de
  meta:
    - name: keywords
      content: "MagicSync Dokumentation, Social-Media-Planer einrichten, Docker Deployment, Self-Hosting, MCP Server, API Keys"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "MagicSync-Dokumentation für Einrichtung, Plattformverbindungen, Planung, KI-Agenten, API-Keys, MCP und Docker-Self-Hosting. Starte mit dem Schnellstart."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Dokumentation"
    description: "Anleitungen zu Einrichtung, Konfiguration, API und Self-Hosting"
    headline: "Alles für den Betrieb von MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Dokumentation
  content: Vom ersten Login bis zum Self-Hosting
actions:
  - label: Dokumentation Öffnen
    href: https://leamsigc.github.io/MagicSync/
    icon: "lucide:arrow-right"
  - label: API-Referenz
    href: /api-reference
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync-Dokumentationsseite"
---
#title
Alles für den Betrieb von <span class="gradient-text">MagicSync</span>

#description
Kurze, aufgabenbasierte Anleitungen statt einer Textwand. Finde die Aufgabe, folge den Schritten und komm zurück zum Veröffentlichen.
::

::BaseFeatures
---
list:
  - title: Erste Schritte
    description: Erstelle einen Bereich, ergänze das Unternehmensprofil und plane deinen ersten Beitrag. Die Checkliste deckt die drei Einrichtungsschritte ab.
    icon: "lucide:rocket"
  - title: Plattformverbindungen
    description: Einrichtungshinweise pro Netzwerk für Facebook, Instagram, X, LinkedIn, Pinterest, Google Unternehmensprofil, TikTok, YouTube und mehr.
    icon: "lucide:plug"
  - title: Planung und Kalender
    description: Lerne Editor, Anpassungen pro Plattform, Drag-and-Drop-Verschieben und den Umgang des Kalenders mit Zeitzonen.
    icon: "lucide:calendar-days"
  - title: KI und Agenten
    description: Konfiguriere Anbieter, schreibe ein Marken-Playbook, nutze das Content-Board und verstehe Freigabestufen vor dem Veröffentlichen.
    icon: "lucide:sparkles"
  - title: API, CLI und MCP
    description: Erstelle API-Keys, rufe die REST-API auf, automatisiere Massenoperationen und verbinde Claude oder andere Assistenten über MCP.
    icon: "lucide:terminal"
  - title: Self-Hosting
    description: Docker-Deployment, Umgebungsvariablen, Datenbankmigrationen, Backups und der Upgrade-Pfad zwischen Releases.
    icon: "lucide:server"
---
#title
Anleitungen nach Aufgabe
#subtitle
Was du mit MagicSync machen kannst
#description
Du musst nicht das ganze Handbuch lesen. Springe direkt zu dem Workflow, den du einrichtest.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Schnellstart

1. **Konto erstellen** unter [Registrieren](/de/register) oder die Self-Hosted-Edition installieren.
2. **Unternehmen anlegen** und Zielgruppe, Leistungen und Tonalität ausfüllen.
3. **Netzwerk verbinden** im Integrationsbildschirm und die angefragten Rechte bestätigen.
4. **Ersten Beitrag planen** im Editor und im Kalender prüfen.
5. **Team einladen**, wenn jemand anders prüfen oder Nachrichten beantworten soll.

## Self-Hosting in Kürze

```bash
git clone https://github.com/leamsigc/MagicSync.git
cd MagicSync
docker compose up -d
```

Setze die Umgebungsvariablen für deine öffentliche URL, das Auth-Secret und die Zugangsdaten der Social-Anbieter und führe dann die Datenbankmigrationen aus. Die vollständige Variablenreferenz und Upgrade-Hinweise stehen in der Dokumentation.

## Wie es Weitergeht

- [API-Referenz](/de/api-reference) für Endpunktgruppen, Authentifizierung und Rechte.
- [Leitfäden](/de/guides) für Schritt-für-Schritt-Marketing-Workflows.
- [Changelog](/de/changelog) für Änderungen zwischen Releases.
- [Blog](/de/blog) für längere Engineering- und Strategiebeiträge.

</section>

::BaseFaq
---
list:
  - label: Muss Ich die Dokumentation für die Cloud-Version Lesen?
    content: Nein. Das geführte Onboarding deckt die drei wesentlichen Schritte ab. Die Dokumentation ist da, wenn du etwas Fortgeschrittenes konfigurieren willst.
    value: '1'
  - label: Wo Finde Ich die Vollständige Liste der Umgebungsvariablen?
    content: Der Self-Hosting-Abschnitt der Dokumentation listet jede Variable, welche Pflicht ist und sichere Standardwerte für die lokale Entwicklung.
    value: '2'
  - label: Gibt es die Dokumentation in Anderen Sprachen?
    content: Die Marketingseiten sind lokalisiert. Die technische Dokumentation wird zuerst auf Englisch gepflegt, übersetzte Leitfäden folgen.
    value: '3'
  - label: Wie Melde Ich Veraltete Dokumentation?
    content: Öffne ein Issue auf GitHub oder sende es über die Supportseite mit Seitentitel und der Änderung.
    value: '4'
---

#title
FAQ zur Dokumentation
#subtitle
Wo du nachsiehst, wenn der Schnellstart nicht reicht.
::

::BaseCallToAction
---
title: Bereit, Deinen Workflow zu Bauen?
description: Starte mit dem Schnellstart und automatisiere alles, was sich noch wiederholt anfühlt.
primaryAction:
  label: Dokumentation Öffnen
  href: https://leamsigc.github.io/MagicSync/
secondaryAction:
  label: API-Referenz Lesen
  href: /api-reference
---
::
