---
layout: default
title: "Changelog MagicSync : Dernières Nouveautés"
description: "Suivez ce qui sort dans MagicSync : améliorations du calendrier, tableau de contenu, facturation, sécurité, nouvelles intégrations et performance."
head:
  htmlAttrs:
    lang: fr
  meta:
    - name: keywords
      content: "changelog MagicSync, nouveautés produit, notes de version, nouvelles fonctionnalités, mises à jour MagicSync"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Équipe MagicSync"
    - name: description
      content: "Suivez ce qui sort dans MagicSync : améliorations du calendrier, tableau de contenu, facturation, sécurité, nouvelles intégrations et performance."
ogImage:
  component: BlogOgImage
  props:
    title: "Changelog MagicSync"
    description: "Nouveautés, correctifs et améliorations"
    headline: "Découvrez les Nouveautés de MagicSync"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Changelog
  content: Livré, pas promis
actions:
  - label: Lire les Notes de Version
    href: /release-notes
    icon: "lucide:arrow-right"
  - label: Voir le Blog
    href: /blog
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Changelog et chronologie des versions MagicSync"
---
#title
Découvrez ce qui est <span class="gradient-text">Nouveau dans MagicSync</span>

#description
Un registre continu des changements importants : nouveaux flux, correctifs de sécurité, travail de performance et intégrations. Les petites retouches de texte restent dehors ; ce qui affecte votre journée, non.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Octobre 2026

### Calendrier reconstruit sur Nuxt UI
Le calendrier hérité a été remplacé par un calendrier natif jour, semaine et mois. Les publications en attente se déplacent pour replanifier, les aperçus par plateforme suivent le dépôt et les calendriers sont partageables par entreprise.

### Vues de collection partagées
Entreprises, intégrations et autres annuaires partagent un même système de collection avec changement de vue, recherche, filtres et tri. Moins d'écrans incohérents, navigation plus rapide.

### Tableau de contenu, profil et facturation
Les cartes de contenu se comportent comme des cartes de tâche avec statuts, priorités, dates relatives et menus contextuels. La facturation a gagné des écrans d'offre, de paiement et de factures via Stripe, et le profil est devenu l'unique vue de compte.

### Connexions Snapchat et dev-null.sh
Snapchat est arrivé via un fournisseur OAuth officiel, avec une connexion de publication dev-null.sh, chacune accompagnée de son guide.

### Sécurité et performance de l'API
L'API résout la session une fois par requête, active un cache court de cookie de session, protège les appels sortants contre le SSRF, chiffre les jetons sociaux au repos et ajoute une limitation de débit ainsi que des en-têtes de sécurité plus stricts.

### Métadonnées YouTube et reprise partielle
Les imports YouTube déduisent un titre et des tags du contenu de la publication, et réessayer une plateforme échouée ne republie plus celles qui ont réussi.

## Septembre 2026

### Plateforme d'agents et tableau de contenu
Le runtime d'agents en processus, le tableau de contenu par entreprise, les scans de tendances, les vérifications SEO/GEO et la publication avec validation sont passés dans le produit principal.

## Août 2026

### Déploiement auto-hébergé
Nous avons publié le chemin de déploiement Docker avec un conteneur non-root, des variables d'environnement documentées et une configuration guidée au premier lancement.

</section>

::BaseFeatures
---
list:
  - title: Rythme de Livraison
    description: Les correctifs sortent en continu ; les grandes fonctions arrivent par vagues thématiques pour que documentation et captures restent à jour.
    icon: "lucide:rocket"
  - title: Compatibilité Descendante
    description: Les publications planifiées continuent de sortir quand les internes changent. Les dépréciations sont annoncées avant suppression.
    icon: "lucide:shield-check"
  - title: Signaux Publics de Roadmap
    description: Les articles de blog expliquent le raisonnement derrière les grands changements, y compris les compromis acceptés.
    icon: "lucide:map"
---
#title
Comment Nous Livrons
#subtitle
Ce que vous pouvez faire avec MagicSync
#description
Un rythme prévisible vaut mieux qu'une méga-version surprise que personne ne peut planifier.
::

::BaseCallToAction
---
title: Vous Voulez les Détails derrière un Changement ?
description: Les notes de version détaillées et les articles d'architecture vivent sur le blog et la documentation.
primaryAction:
  label: Lire les Notes de Version
  href: /release-notes
secondaryAction:
  label: Voir le Blog
  href: /blog
---
::
