---
layout: default
title: "API-Referenz: REST und MCP Endpunkte | MagicSync"
description: "Baue auf MagicSync mit API-Keys, begrenzten REST-Endpunkten für Beiträge, Unternehmen, Medien und Analytik sowie einem MCP-Server für KI-Assistenten."
head:
  htmlAttrs:
    lang: de
  meta:
    - name: keywords
      content: "Social-Media-API, Planungs-API, MCP Server, API Keys, Beiträge automatisieren, MagicSync API"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Baue auf MagicSync mit API-Keys, begrenzten REST-Endpunkten für Beiträge, Unternehmen, Medien und Analytik sowie einem MCP-Server für KI-Assistenten."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync API-Referenz"
    description: "REST-Endpunkte, Rechte und der MCP-Server"
    headline: "Baue auf der MagicSync API"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Entwickler-API
  content: REST, CLI und MCP
actions:
  - label: API-Key Erstellen
    href: /app/keys
    icon: "lucide:arrow-right"
  - label: Dokumentation Lesen
    href: /documentation
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync API-Keys und Endpunktdokumentation"
---
#title
Baue auf der <span class="gradient-text">MagicSync API</span>

#description
Alles, was die Oberfläche kann, steht Skripten und KI-Assistenten zur Verfügung: Beiträge erstellen, einreihen, Ergebnisse prüfen und Analytik lesen – mit begrenzten Keys und Audit-Logging.
::

::BaseFeatures
---
list:
  - title: Begrenzte API-Keys
    description: Erstelle Lese- oder Vollzugriffs-Keys pro Arbeitsbereich. Widerrufe einen Key sofort, ohne den Rest deiner Automatisierung zu berühren.
    icon: "lucide:key-round"
  - title: REST-Ressourcengruppen
    description: Vorhersehbare JSON-Endpunkte für Beiträge, Unternehmen, Konten, Medien, Analytik, Vorlagen und die Agentenlaufzeit.
    icon: "lucide:braces"
  - title: MCP-Server
    description: Verbinde Claude oder einen beliebigen MCP-Client, um Tools und Ressourcen zu entdecken und Beiträge in natürlicher Sprache zu entwerfen.
    icon: "lucide:bot"
  - title: Jeden Aufruf Auditieren
    description: Jede Anfrage wird einem Key zugeordnet und protokolliert, sodass du siehst, welche Automatisierung einen Beitrag erstellt oder geändert hat.
    icon: "lucide:scroll-text"
---
#title
Für Automatisierung Gebaut
#subtitle
Was du mit MagicSync machen kannst
#description
Stabile Formen, klare Rechte und Logs, die beantworten, wer das geändert hat.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Authentifizierung

Erstelle einen Key unter [API-Keys](/de/app/keys) und sende ihn als Bearer-Token:

```bash
curl https://magicsync.dev/api/v1/posts \
  -H "Authorization: Bearer $MAGICSYNC_API_KEY"
```

Keys gehören zu einem Nutzer und sind auf dessen Unternehmen begrenzt. Lese-Keys können auflisten und abrufen; Vollzugriffs-Keys können erstellen, aktualisieren, planen und veröffentlichen.

## Endpunktgruppen

| Gruppe | Basispfad | Typische Nutzung |
|---|---|---|
| Beiträge | `/api/v1/posts` | Erstellen, aktualisieren, planen, prüfen |
| Unternehmen | `/api/v1/business` | Arbeitsbereiche, Profile und Markenkontext |
| Konten | `/api/v1/accounts` | Verbundene Social-Konten und Status |
| Medien | `/api/v1/media` | Bilder und Videos hochladen und referenzieren |
| Analytik | `/api/v1/stats` | Reichweite, Interaktion und Leistung |
| Vorlagen | `/api/v1/templates` | Wiederverwendbare Beitrags- und Variablenvorlagen |
| Massenplaner | `/api/v1/bulk-scheduler` | CSV-Importe und Batch-Erstellung |
| Agenten | `/api/v1/agent` | Chatsitzungen, Fähigkeiten und Läufe |
| API-Keys | `/api/v1/api-keys` | Keys erstellen, auflisten und widerrufen |
| MCP | `/mcp` | Tool- und Ressourcen-Discovery für KI-Clients |

Genaue Request-Bodys, Parameter und Antwortschemata stehen pro Endpunkt in der OpenAPI-Beschreibung der laufenden Instanz.

## MCP in Einer Minute

Richte einen MCP-Client auf `https://magicsync.dev/mcp`, authentifiziere dich mit einem Key oder OAuth, und der Assistent kann Tools und Ressourcen auflisten. Freigabegesteuerte Aktionen bleiben geschützt: Der Assistent entwirft und reiht ein, das Veröffentlichen folgt den Rechten des Keys.

## CLI

Die begleitende CLI umschließt dieselbe API für Terminal-Workflows wie Massen-Textimporte und geplante Prüfungen. Siehe die [CLI-Anleitung](/de/blogs/magicsync-cli-social-media-automation).

</section>

::BaseFaq
---
list:
  - label: Gibt es ein Rate-Limit?
    content: Ja. Anfragen werden pro Key und pro IP begrenzt, mit höheren Limits für authentifizierte Workspace-Keys. Antworten enthalten Hinweise zum erneuten Versuch.
    value: '1'
  - label: Kann ein Key Ohne Freigabe Veröffentlichen?
    content: Nur ein Vollzugriffs-Key kann direkt veröffentlichen. Lese-Keys können Beiträge weder erstellen noch ändern, und freigabegesteuerte Workflows benötigen weiterhin eine menschliche Entscheidung.
    value: '2'
  - label: Bietet Ihr ein OpenAPI-Schema?
    content: Ja. Die laufende Instanz stellt eine OpenAPI-Beschreibung bereit, die du in Postman, Insomnia oder einen Client-Generator importieren kannst.
    value: '3'
  - label: Ist die API bei Self-Hosted-Installationen Verfügbar?
    content: Ja. Dieselben Routen sind in der Docker-Edition enthalten. Richte deine Basis-URL auf deine eigene Domain.
    value: '4'
  - label: Wie Rotiere Ich einen Geleakten Key?
    content: Widerrufe ihn sofort im API-Keys-Bildschirm und erstelle einen Ersatz. Der Widerruf wirkt bei der nächsten Anfrage.
    value: '5'
---

#title
FAQ zur API
#subtitle
Authentifizierung, Limits und Sicherheit für programmatischen Zugriff.
::

::BaseCallToAction
---
title: Erstelle Deinen Ersten API-Key
description: Generiere einen begrenzten Key und stelle deine erste Anfrage in wenigen Minuten.
primaryAction:
  label: API-Keys Öffnen
  href: /app/keys
secondaryAction:
  label: Dokumentation Lesen
  href: /documentation
---
::
