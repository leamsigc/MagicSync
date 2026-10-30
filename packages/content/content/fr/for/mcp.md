---
layout: default
title: "MCP Server + MagicSync — Un endpoint MCP pour tout client IA"
description: "MagicSync expose 18 outils et 4 ressources via MCP, avec OAuth ou clés API, lecture seule ou accès complet et journal d’audit."
seo:
  twitterCard: summary_large_image
  twitterTitle: "MCP Server + MagicSync — Un endpoint MCP pour tout client IA"
  twitterDescription: "Un endpoint MCP pour tout client IA"
  ogTitle: "MCP Server + MagicSync — Un endpoint MCP pour tout client IA"
  ogDescription: "Un endpoint MCP pour tout client IA"
ogImage:
  component: BlogOgImage
  props:
    title: "MCP Server + MagicSync"
    description: "Un endpoint MCP pour tout client IA"
    headline: "Agents IA · MCP Server"
    imageUrl: "/img/home-dark.png"
head:
  htmlAttrs:
    lang: fr
---

::BaseHero
---
badge:
  label: "Agents IA"
  content: "MagicSync MCP"
actions:
  - label: "Commencer gratuitement"
    href: /register
    icon: "lucide:arrow-right"
  - label: "Documentation MCP"
    href: /guide/mcp
    variant: outline
showHeroImage: false
---
#title
MCP Server + MagicSync

#description
Un endpoint MCP pour tout client IA. MagicSync expose 18 outils et 4 ressources via MCP, avec OAuth ou clés API, lecture seule ou accès complet et journal d’audit.
::

::AgentConnect
---
agent: "mcp"
tagline: "Un endpoint MCP pour tout client IA. MagicSync expose 18 outils et 4 ressources via MCP, avec OAuth ou clés API, lecture seule ou accès complet et journal d’audit."
---
::

::BaseFeatures
---
list:
  - title: "Publication native pour agents"
    description: "Demandez en langage naturel. MagicSync produit brouillons, posts planifiés et formats par plateforme."
    icon: "lucide:bot"
  - title: "Un calendrier pour toutes les chaînes"
    description: "Instagram, X, LinkedIn, Facebook, Threads, TikTok, YouTube, Bluesky, Pinterest, Reddit, WordPress et plus — une file unique."
    icon: "lucide:calendar-check"
  - title: "Validations et journal d’audit"
    description: "Chaque appel est journalisé. La publication attend votre validation jusqu’à l’accès complet."
    icon: "lucide:shield-check"
  - title: "Plus de 18 plateformes"
    description: "Les mêmes comptes connectés que dans MagicSync, avec leurs limites et aperçus."
    icon: "lucide:share-2"
---
#title
Ce que MCP Server peut faire avec MagicSync
#description
Tout ce dont votre agent a besoin pour planifier, publier et rendre des comptes.
::

::AgentPromptMock
::

::BaseFaq
---
list:
  - label: "Comment connecter MCP Server à MagicSync ?"
    content: "Copiez l’endpoint MCP MagicSync, ajoutez-le à MCP Server comme connecteur MCP personnalisé et validez l’accès avec votre compte. Aucune clé API avec OAuth."
    value: '1'
  - label: "Faut-il une clé API ?"
    content: "Pas pour les clients MCP compatibles OAuth. Les scripts utilisent une clé API limitée créée dans API Keys."
    value: '2'
  - label: "MCP Server voit-il mes mots de passe sociaux ?"
    content: "Non. MagicSync stocke les jetons et expose des outils via MCP. L’agent ne reçoit que les résultats, jamais vos identifiants."
    value: '3'
  - label: "Publiera-t-il sans ma validation ?"
    content: "Les écritures sont bloquées par défaut. Vous pouvez exiger une validation ou accorder un accès complet."
    value: '4'
  - label: "MagicSync est-il gratuit ?"
    content: "Oui. Auto-hébergement gratuit ou offre hébergée avec analyses et équipe."
    value: '5'
---
#title
Questions fréquentes
#description
Réponses courtes sur la connexion, l’accès et la publication.
::

::AgentOtherAgents
---
agent: "mcp"
---
::

::BaseCallToAction
---
title: "Laissez MCP Server gérer vos réseaux"
description: "Connectez MagicSync une fois et retrouvez les mêmes comptes, validations, calendrier et analyses."
primaryAction:
  label: "Commencer gratuitement"
  href: /register
secondaryAction:
  label: "Documentation MCP"
  href: /guide/mcp
---
::
