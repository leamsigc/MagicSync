---
layout: default
title: "Statut MagicSync : Disponibilité de la Plateforme"
description: "Statut actuel de l'application web, de l'API, du planificateur, des workers de publication, des services IA et de la diffusion de contenu de MagicSync."
head:
  htmlAttrs:
    lang: fr
  meta:
    - name: keywords
      content: "statut MagicSync, disponibilité, panne, API, publication échouée, état de la plateforme"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Équipe MagicSync"
    - name: description
      content: "Statut actuel de l'application web, de l'API, du planificateur, des workers de publication, des services IA et de la diffusion de contenu de MagicSync."
ogImage:
  component: BlogOgImage
  props:
    title: "Statut de la Plateforme MagicSync"
    description: "Disponibilité des services et gestion des incidents"
    headline: "Statut de la Plateforme en Direct"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Tous les Systèmes
  content: Services principaux opérationnels
actions:
  - label: Signaler un Problème
    href: /support
    icon: "lucide:arrow-right"
  - label: Voir le Changelog
    href: /changelog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Tableau de bord du statut des services MagicSync"
---
#title
Statut de la Plateforme <span class="gradient-text">en Direct</span>

#description
Le moyen le plus rapide de savoir si le problème vient de chez nous. Pendant un incident, cette page est mise à jour en premier, avant que les files de support ne se remplissent.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Statut du cloud géré

| Service | Statut | Couverture |
|---|---|---|
| Application web | Opérationnelle | Connexion, tableau de bord, calendrier, éditeur |
| API publique | Opérationnelle | Requêtes `/api/v1/*` et accès par clé API |
| Planificateur | Opérationnel | Envoi des publications planifiées et déclenchées |
| Workers de publication | Opérationnels | Livraison vers les réseaux connectés |
| Services IA | Opérationnels | Textes, accroches et réutilisation |
| Médias et imports | Opérationnels | Import, stockage et diffusion des ressources |
| MCP et agents | Opérationnels | Outils `/mcp`, sessions de chat et tableau de contenu |

**Dernière revue :** octobre 2026. Le cloud géré vise 99,9 % de disponibilité mensuelle pour l'application web, l'API et le planificateur.

## Si une Publication Planifiée n'est pas Sortie

1. Ouvrez la publication et lisez l'erreur par plateforme. La plupart des échecs viennent d'un jeton expiré, d'une permission manquante ou d'un format de média refusé.
2. Reconnectez le compte concerné depuis l'écran des intégrations.
3. Réessayez uniquement la plateforme échouée. MagicSync ignore celles déjà publiées, pour que vos abonnés ne voient pas de doublons.

## Installations Auto-Hébergées

Si vous exécutez l'édition Docker, votre disponibilité dépend de votre infrastructure. Utilisez l'endpoint de santé depuis votre supervision et considérez cette page comme une référence pour les API sociales, pas comme un rapport sur votre serveur.

## Comment les Incidents sont Gérés

Un incident est **dégradé** quand la publication est retardée mais mise en file, et **panne** quand de nouvelles publications ne peuvent être mises en file ni livrées. Pendant une panne, le support priorise les publications urgentes et les plannings concernés sont réessayés automatiquement au rétablissement.

</section>

::BaseFaq
---
list:
  - label: Cette Page Surveille-t-elle mon Installation Auto-Hébergée ?
    content: Non. Elle concerne le cloud MagicSync géré. Votre installation possède ses propres journaux et contrôles de santé.
    value: '1'
  - label: À Quelle Fréquence le Statut est-il Mis à Jour ?
    content: Au début et à la fin de chaque incident, et au moins toutes les 30 minutes pendant un incident actif.
    value: '2'
  - label: Les Publications Manquées Sortent-elles Automatiquement Après une Panne ?
    content: Les publications en file sont réessayées au rétablissement. Celles dont la fenêtre est entièrement passée sont signalées pour revue plutôt que publiées des heures plus tard.
    value: '3'
  - label: Où Signaler un Problème Absent de cette Page ?
    content: Envoyez-le via la page de support avec l'ID de publication, la plateforme et l'heure approximative, pour que nous puissions le corréler aux journaux serveur.
    value: '4'
---

#title
FAQ sur le Statut
#subtitle
Comment lire cette page et quoi faire quand quelque chose semble anormal.
::

::BaseCallToAction
---
title: Vous Voyez Toujours un Problème ?
description: Envoyez-nous l'ID de publication et la plateforme. Nous le tracerons dans les journaux de publication.
primaryAction:
  label: Contacter le Support
  href: /support
secondaryAction:
  label: Lire les Guides
  href: /guides
---
::
