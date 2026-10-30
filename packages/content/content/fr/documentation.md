---
layout: default
title: "Documentation : Installer et Étendre | MagicSync"
description: "Documentation MagicSync pour l'installation, les connexions, la planification, les agents IA, les clés API, MCP et le déploiement Docker auto-hébergé."
head:
  htmlAttrs:
    lang: fr
  meta:
    - name: keywords
      content: "documentation MagicSync, installer planificateur réseaux sociaux, déploiement Docker, auto-hébergement, serveur MCP, clés API"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Équipe MagicSync"
    - name: description
      content: "Documentation MagicSync pour l'installation, les connexions, la planification, les agents IA, les clés API, MCP et le déploiement Docker auto-hébergé."
ogImage:
  component: BlogOgImage
  props:
    title: "Documentation MagicSync"
    description: "Guides d'installation, configuration, API et auto-hébergement"
    headline: "Tout pour Faire Tourner MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Documentation
  content: De la première connexion à l'auto-hébergement
actions:
  - label: Ouvrir la Documentation
    href: https://leamsigc.github.io/MagicSync/
    icon: "lucide:arrow-right"
  - label: Référence API
    href: /api-reference
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Site de documentation MagicSync"
---
#title
Tout pour Faire Tourner <span class="gradient-text">MagicSync</span>

#description
Des guides courts et orientés tâches plutôt qu'un mur de texte. Trouvez ce que vous devez faire, suivez les étapes et revenez publier.
::

::BaseFeatures
---
list:
  - title: Premiers Pas
    description: Créez un espace, ajoutez le profil de votre entreprise et planifiez votre première publication. La checklist guidée couvre les trois étapes.
    icon: "lucide:rocket"
  - title: Connexions Plateformes
    description: Notes de configuration par réseau pour Facebook, Instagram, X, LinkedIn, Pinterest, Google Business Profile, TikTok, YouTube et plus.
    icon: "lucide:plug"
  - title: Planification et Calendrier
    description: Apprenez l'éditeur, les remplacements par plateforme, la replanification par glisser-déposer et la gestion des fuseaux horaires.
    icon: "lucide:calendar-days"
  - title: IA et Agents
    description: Configurez les fournisseurs, écrivez un playbook de marque, utilisez le tableau de contenu et comprenez les validations avant publication.
    icon: "lucide:sparkles"
  - title: API, CLI et MCP
    description: Créez des clés API, appelez l'API REST, automatisez des opérations en masse et connectez Claude ou un autre assistant via MCP.
    icon: "lucide:terminal"
  - title: Auto-Hébergement
    description: Déploiement Docker, variables d'environnement, migrations de base de données, sauvegardes et chemin de mise à jour entre versions.
    icon: "lucide:server"
---
#title
Guides Organisés par Tâche
#subtitle
Ce que vous pouvez faire avec MagicSync
#description
Pas besoin de lire tout le manuel. Allez directement au flux que vous configurez.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Démarrage rapide

1. **Créez votre compte** sur [inscription](/fr/register) ou déployez l'édition auto-hébergée.
2. **Créez une entreprise** et renseignez l'audience, les services et le ton de voix.
3. **Connectez un réseau** depuis l'écran des intégrations et approuvez les autorisations demandées.
4. **Planifiez votre première publication** depuis l'éditeur et confirmez-la dans le calendrier.
5. **Invitez votre équipe** si quelqu'un d'autre doit valider ou répondre aux messages.

## Auto-hébergement en bref

```bash
git clone https://github.com/leamsigc/MagicSync.git
cd MagicSync
docker compose up -d
```

Définissez les variables d'environnement pour votre URL publique, le secret d'authentification et les identifiants des fournisseurs sociaux, puis exécutez les migrations de base de données. La référence complète des variables et les notes de mise à jour se trouvent dans la documentation.

## Où Aller Ensuite

- [Référence API](/fr/api-reference) pour les groupes d'endpoints, l'authentification et les permissions.
- [Guides](/fr/guides) pour des flux marketing pas à pas.
- [Changelog](/fr/changelog) pour ce qui a changé entre versions.
- [Blog](/fr/blog) pour des articles plus longs d'ingénierie et de stratégie.

</section>

::BaseFaq
---
list:
  - label: Faut-il Lire la Documentation pour la Version Cloud ?
    content: Non. L'onboarding guidé couvre les trois étapes essentielles. La documentation est là quand vous voulez configurer quelque chose d'avancé.
    value: '1'
  - label: Où Trouver la Liste Complète des Variables d'Environnement ?
    content: La section auto-hébergement de la documentation liste chaque variable, lesquelles sont obligatoires et les valeurs sûres pour le développement local.
    value: '2'
  - label: La Documentation Existe-t-elle dans d'Autres Langues ?
    content: Les pages marketing sont localisées. La documentation technique est maintenue d'abord en anglais, avec des guides traduits au fur et à mesure.
    value: '3'
  - label: Comment Signaler une Documentation Obsolète ?
    content: Ouvrez une issue sur GitHub ou envoyez-la via la page de support avec le titre de la page et ce qui a changé.
    value: '4'
---

#title
FAQ sur la Documentation
#subtitle
Où regarder quand le démarrage rapide ne suffit pas.
::

::BaseCallToAction
---
title: Prêt à Construire votre Flux ?
description: Commencez par le guide de démarrage, puis automatisez tout ce qui reste répétitif.
primaryAction:
  label: Ouvrir la Documentation
  href: https://leamsigc.github.io/MagicSync/
secondaryAction:
  label: Lire la Référence API
  href: /api-reference
---
::
