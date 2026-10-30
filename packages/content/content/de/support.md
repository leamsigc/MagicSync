---
layout: default
title: "Support: Hilfe zu MagicSync"
description: "Erhalte Hilfe zu MagicSync: Fehlerbehebung bei fehlgeschlagenen Beiträgen, Kontoverbindungen, Abrechnung und Self-Hosted-Deployments."
head:
  htmlAttrs:
    lang: de
  meta:
    - name: keywords
      content: "MagicSync Support, Social-Media-Planer Hilfe, fehlgeschlagener Beitrag, Social-Konto neu verbinden, Abrechnungshilfe"
    - name: robots
      content: "index, follow"
    - name: author
      content: "MagicSync Team"
    - name: description
      content: "Erhalte Hilfe zu MagicSync: Fehlerbehebung bei fehlgeschlagenen Beiträgen, Kontoverbindungen, Abrechnung und Self-Hosted-Deployments."
ogImage:
  component: BlogOgImage
  props:
    title: "MagicSync Support"
    description: "Fehlerbehebung, Dokumentation und direkte Hilfe"
    headline: "Hilfe, Wenn Du Sie Brauchst"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Support
  content: Echte Antworten, kein Labyrinth
actions:
  - label: Support Schreiben
    href: mailto:MagicSync@leamsigc.com
    icon: "lucide:mail"
  - label: Status Prüfen
    href: /status
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "MagicSync Support und Fehlerbehebung"
---
#title
Hilfe, Wenn Du Sie <span class="gradient-text">Brauchst</span>

#description
Beginne mit den Selbsthilfeantworten unten. Wenn sie nicht helfen, schreib uns mit Beitrags-ID, Plattform und Uhrzeit, damit wir den genauen Veröffentlichungsversuch nachvollziehen können.
::

::BaseFeatures
---
list:
  - title: Dokumentation
    description: Anleitungen zu Einrichtung, Verbindungen, Planung, API und Self-Hosting, durchsuchbar und aufgabenbasiert.
    icon: "lucide:book-open"
  - title: Statusseite
    description: Prüfe, ob ein Ausfall oder ein API-Problem der Plattform das Verhalten erklärt, bevor du deine Einrichtung debuggst.
    icon: "lucide:activity"
  - title: Leitfäden und Blog
    description: Schritt-für-Schritt-Anleitungen für häufige Workflows, von der ersten Planungswoche bis zu Massenimporten und KI-Wiederverwertung.
    icon: "lucide:newspaper"
  - title: E-Mail-Support
    description: Bei kontospezifischen Problemen sende Beitrags-ID, Plattform und ungefähre Uhrzeit, damit wir Serverlogs abgleichen können.
    icon: "lucide:mail"
---
#title
Finde den Schnellsten Weg zur Antwort
#subtitle
Was du mit MagicSync machen kannst
#description
Die meisten Probleme fallen in vier Kategorien. Starte mit der passenden Lösung.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Ein Beitrag Wurde Nicht Veröffentlicht

Öffne den Beitrag und lies den Fehler pro Plattform. Die drei häufigsten Ursachen sind ein abgelaufenes Token, eine fehlende Berechtigung und ein nicht unterstütztes Medienformat. Verbinde das Konto im Integrationsbildschirm neu und wiederhole nur die fehlgeschlagene Plattform. Bereits veröffentlichte Plattformen werden übersprungen, sodass keine Duplikate entstehen.

## Ein Konto Verbindet Sich Nicht

Prüfe, ob du im selben Browser mit dem richtigen Plattformprofil angemeldet bist, ob das Konto die nötige Administratorrolle hat und ob Pop-ups während der Autorisierung blockiert werden. Bei Facebook-Seiten und LinkedIn-Unternehmensseiten muss das persönliche Profil, das den Zugriff bestätigt, Administrator der Seite sein.

## Abrechnung oder Planfragen

Planwechsel, Rechnungen und Kündigung findest du auf der [Abrechnungsseite](/de/app/billing). Wenn eine Zahlung erfolgreich war, der Plan aber nicht aktualisiert wurde, nenne Rechnungs-ID und Konto-E-Mail bei der Kontaktaufnahme.

## Self-Hosted-Deployment-Probleme

Prüfe zuerst Container-Logs und Health-Endpoint. Die meisten fehlgeschlagenen ersten Starts kommen von fehlenden Umgebungsvariablen, einer nicht migrierten Datenbank oder einer öffentlichen URL, die nicht zum konfigurierten Auth-Callback passt.

## Was in Eine Support-Mail Gehört

- Die E-Mail-Adresse deines Kontos.
- Die Beitrags-ID oder das Konto, das du verbinden wolltest.
- Die Plattform und die ungefähre Uhrzeit in deiner Zeitzone.
- Der genaue Fehlertext oder ein Screenshot.
- Ob das Problem immer oder nur einmal auftritt.

</section>

::BaseFaq
---
list:
  - label: Wie Schnell Ist der Support?
    content: Pro- und Enterprise-Kunden erhalten priorisierten E-Mail-Support, meist innerhalb eines Werktags. Self-Hosted-Nutzer erhalten Community-Support über GitHub.
    value: '1'
  - label: Gibt es Telefonischen Support?
    content: E-Mail ist der Hauptkanal, weil Beitrags-ID, Screenshots und Logs in einem Thread bleiben. Enterprise-Vereinbarungen können geplante Calls enthalten.
    value: '2'
  - label: Könnt Ihr Einen Beitrag für Mich Veröffentlichen?
    content: Wir können diagnostizieren, warum eine Veröffentlichung fehlschlug, aber nicht in deinem Namen posten. So bleiben Freigabe und Kontokontrolle bei dir.
    value: '3'
  - label: Ich Habe ein Sicherheitsproblem Gefunden. Wohin Melde Ich Es?
    content: Schreib uns mit dem Betreff Sicherheit und genug Details zur Reproduktion. Bitte veröffentliche keine Exploit-Details, bevor wir antworten.
    value: '4'
  - label: Deckt der Support Änderungen der Plattformrichtlinien Ab?
    content: Wir erklären, wie MagicSync mit API-Änderungen umgeht, aber Sperrungen und Richtlinienentscheidungen bleiben zwischen dir und der Plattform.
    value: '5'
  - label: Wo Kann Ich Eine Funktion Wünschen?
    content: Öffne ein Issue auf GitHub oder sende es über den Support. Nenne den Workflow, den du abschließen willst, nicht nur den gewünschten Button.
    value: '6'
---

#title
FAQ zum Support
#subtitle
Antwortzeiten, Umfang und wie du schnell eine hilfreiche Antwort bekommst.
::

::BaseCallToAction
---
title: Sende Uns die Details
description: Beitrags-ID, Plattform und Uhrzeit reichen meist, um Publishing-Probleme nachzuvollziehen.
primaryAction:
  label: Support Schreiben
  href: mailto:MagicSync@leamsigc.com
secondaryAction:
  label: Dokumentation Lesen
  href: /documentation
---
::
