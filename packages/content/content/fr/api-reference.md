---
layout: default
title: "Référence API : REST et MCP | MagicSync"
description: "Développez sur MagicSync avec des clés API, des endpoints REST limités pour publications, entreprises, médias et analytique, et un serveur MCP pour assistants IA."
head:
  htmlAttrs:
    lang: fr
  meta:
    - name: keywords
      content: "API réseaux sociaux, API de planification, serveur MCP, clés API, automatiser publications, API MagicSync"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Équipe MagicSync"
    - name: description
      content: "Développez sur MagicSync avec des clés API, des endpoints REST limités pour publications, entreprises, médias et analytique, et un serveur MCP pour assistants IA."
ogImage:
  component: BlogOgImage
  props:
    title: "Référence API MagicSync"
    description: "Endpoints REST, permissions et serveur MCP"
    headline: "Construisez sur l'API MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: API Développeur
  content: REST, CLI et MCP
actions:
  - label: Créer une Clé API
    href: /app/keys
    icon: "lucide:arrow-right"
  - label: Lire la Documentation
    href: /documentation
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Clés API et documentation des endpoints MagicSync"
---
#title
Construisez sur l'<span class="gradient-text">API MagicSync</span>

#description
Tout ce que l'interface peut faire est disponible pour les scripts et assistants IA : créer, mettre en file, inspecter les résultats et lire l'analytique avec des clés limitées et un journal d'audit.
::

::BaseFeatures
---
list:
  - title: Clés API Limitées
    description: Créez des clés lecture seule ou accès complet par espace. Révoquez une clé instantanément sans toucher au reste de votre automatisation.
    icon: "lucide:key-round"
  - title: Groupes de Ressources REST
    description: Des endpoints JSON prévisibles pour publications, entreprises, comptes, médias, analytique, modèles et runtime d'agents.
    icon: "lucide:braces"
  - title: Serveur MCP
    description: Connectez Claude ou tout client MCP pour découvrir outils et ressources, puis rédiger et planifier des publications en langage naturel.
    icon: "lucide:bot"
  - title: Auditer Chaque Appel
    description: Chaque requête est attribuée à une clé et enregistrée, pour voir quelle automatisation a créé ou modifié une publication.
    icon: "lucide:scroll-text"
---
#title
Conçue pour l'Automatisation
#subtitle
Ce que vous pouvez faire avec MagicSync
#description
Des formes stables, des permissions explicites et des journaux qui répondent à qui a changé ceci.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Authentification

Créez une clé sur [Clés API](/fr/app/keys) et envoyez-la comme jeton bearer :

```bash
curl https://magicsync.dev/api/v1/posts \
  -H "Authorization: Bearer $MAGICSYNC_API_KEY"
```

Les clés appartiennent à un utilisateur et sont limitées à ses entreprises. Les clés lecture seule peuvent lister et consulter ; les clés accès complet peuvent créer, modifier, planifier et publier.

## Groupes d'endpoints

| Groupe | Chemin de base | Usage typique |
|---|---|---|
| Publications | `/api/v1/posts` | Créer, modifier, planifier, inspecter |
| Entreprises | `/api/v1/business` | Espaces, profils et contexte de marque |
| Comptes | `/api/v1/accounts` | Comptes sociaux connectés et statut |
| Médias | `/api/v1/media` | Importer et référencer images et vidéos |
| Analytique | `/api/v1/stats` | Portée, engagement et performance |
| Modèles | `/api/v1/templates` | Modèles de publication et variables |
| Planificateur en masse | `/api/v1/bulk-scheduler` | Imports CSV et création par lots |
| Agents | `/api/v1/agent` | Sessions de chat, capacités et exécutions |
| Clés API | `/api/v1/api-keys` | Créer, lister et révoquer des clés |
| MCP | `/mcp` | Découverte d'outils pour clients IA |

Les corps exacts, paramètres et schémas de réponse sont documentés par endpoint dans la description OpenAPI exposée par l'instance.

## MCP en une minute

Pointez un client MCP vers `https://magicsync.dev/mcp`, authentifiez-vous avec une clé ou OAuth, et l'assistant peut lister outils et ressources. Les actions soumises à validation restent protégées : l'assistant rédige et met en file, la publication suit les permissions de la clé.

## CLI

La CLI complémentaire enveloppe la même API pour les flux terminal comme les imports de texte en masse et les vérifications planifiées. Consultez le [guide CLI](/fr/blogs/magicsync-cli-social-media-automation).

</section>

::BaseFaq
---
list:
  - label: Y a-t-il une Limite de Requêtes ?
    content: Oui. Les requêtes sont limitées par clé et par IP, avec des limites plus élevées pour les clés d'espace authentifiées. Les réponses indiquent comment réessayer.
    value: '1'
  - label: Une Clé Peut-elle Publier sans Validation ?
    content: Seule une clé accès complet peut publier directement. Les clés lecture seule ne créent ni ne modifient de publications, et les flux avec validation exigent toujours une décision humaine.
    value: '2'
  - label: Fournissez-vous un Schéma OpenAPI ?
    content: Oui. L'instance expose une description OpenAPI de l'API, importable dans Postman, Insomnia ou un générateur de client.
    value: '3'
  - label: L'API est-elle Disponible en Auto-Hébergement ?
    content: Oui. Les mêmes routes sont livrées avec l'édition Docker. Pointez votre URL de base vers votre propre domaine.
    value: '4'
  - label: Comment Renouveler une Clé Compromise ?
    content: Révoquez-la immédiatement depuis l'écran des clés API puis créez un remplacement. La révocation prend effet à la requête suivante.
    value: '5'
---

#title
FAQ sur l'API
#subtitle
Authentification, limites et sécurité de l'accès programmatique.
::

::BaseCallToAction
---
title: Créez votre Première Clé API
description: Générez une clé limitée et faites votre première requête en quelques minutes.
primaryAction:
  label: Ouvrir les Clés API
  href: /app/keys
secondaryAction:
  label: Lire la Documentation
  href: /documentation
---
::
