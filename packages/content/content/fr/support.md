---
layout: default
title: "Support : Obtenir de l'Aide avec MagicSync"
description: "Obtenez de l'aide avec MagicSync : résolution des publications échouées, connexion des comptes, facturation et déploiements auto-hébergés."
head:
  htmlAttrs:
    lang: fr
  meta:
    - name: keywords
      content: "support MagicSync, aide planificateur réseaux sociaux, publication planifiée échouée, reconnecter compte social, aide facturation"
    - name: robots
      content: "index, follow"
    - name: author
      content: "Équipe MagicSync"
    - name: description
      content: "Obtenez de l'aide avec MagicSync : résolution des publications échouées, connexion des comptes, facturation et déploiements auto-hébergés."
ogImage:
  component: BlogOgImage
  props:
    title: "Support MagicSync"
    description: "Dépannage, documentation et aide directe"
    headline: "De l'Aide Quand vous en Avez Besoin"
    imageUrl: "/img/home-dark.png"
---

::BaseHero
---
badge:
  label: Support
  content: De vraies réponses, pas un labyrinthe
actions:
  - label: Écrire au Support
    href: mailto:MagicSync@leamsigc.com
    icon: "lucide:mail"
  - label: Voir le Statut
    href: /status
    variant: secondary
heroImage:
  light: "/img/home-light.png"
  dark: "/img/home-dark.png"
  alt: "Support et dépannage MagicSync"
---
#title
De l'Aide Quand vous en Avez <span class="gradient-text">Besoin</span>

#description
Commencez par les réponses en libre-service ci-dessous. Si elles ne suffisent pas, écrivez-nous avec l'ID de publication, la plateforme et l'heure, et nous tracerons la tentative exacte.
::

::BaseFeatures
---
list:
  - title: Documentation
    description: Guides d'installation, connexions, planification, API et auto-hébergement, tous consultables et orientés tâches.
    icon: "lucide:book-open"
  - title: Page de Statut
    description: Vérifiez si une panne ou un problème d'API de la plateforme explique le comportement avant de déboguer votre configuration.
    icon: "lucide:activity"
  - title: Guides et Blog
    description: Tutoriels pas à pas pour les flux courants, de la première semaine de planification aux imports en masse et à la réutilisation IA.
    icon: "lucide:newspaper"
  - title: Support E-mail
    description: Pour les problèmes de compte, envoyez l'ID de publication, la plateforme et l'heure approximative pour corréler les journaux.
    icon: "lucide:mail"
---
#title
Trouvez le Chemin le Plus Rapide vers une Réponse
#subtitle
Ce que vous pouvez faire avec MagicSync
#description
La plupart des problèmes entrent dans quatre catégories. Commencez par la solution correspondante.
::

<section class="mx-auto prose dark:prose-invert pt-6 text-sm md:text-xl">

## Une Publication n'est pas Sortie

Ouvrez la publication et lisez l'erreur par plateforme. Les trois causes les plus courantes sont un jeton expiré, une permission manquante et un format de média non pris en charge. Reconnectez le compte depuis l'écran des intégrations et réessayez uniquement la plateforme échouée. Celles déjà publiées sont ignorées, donc aucun doublon.

## Un Compte ne se Connecte pas

Vérifiez que vous êtes connecté au bon profil de plateforme dans le même navigateur, que le compte a le rôle administrateur requis et que les pop-ups ne sont pas bloqués pendant l'autorisation. Pour les pages Facebook et les pages entreprise LinkedIn, le profil personnel qui approuve l'accès doit être administrateur de la page.

## Facturation ou Questions d'Offre

Les changements d'offre, les factures et l'annulation se trouvent sur la [page de facturation](/fr/app/billing). Si un paiement a réussi mais que l'offre n'a pas changé, joignez l'ID de facture et l'e-mail du compte.

## Problèmes de Déploiement Auto-Hébergé

Vérifiez d'abord les journaux du conteneur et l'endpoint de santé. La plupart des premiers lancements échoués viennent de variables d'environnement manquantes, d'une base de données non migrée ou d'une URL publique qui ne correspond pas au callback d'authentification.

## Ce qu'il Faut Inclure dans un E-mail de Support

- L'adresse e-mail de votre compte.
- L'ID de publication ou le compte que vous tentiez de connecter.
- La plateforme et l'heure approximative dans votre fuseau horaire.
- Le texte exact de l'erreur ou une capture.
- Si le problème arrive toujours ou une seule fois.

</section>

::BaseFaq
---
list:
  - label: Quel est le Délai de Réponse ?
    content: Les clients Pro et Enterprise reçoivent un support e-mail prioritaire, généralement sous un jour ouvré. Les utilisateurs auto-hébergés ont le support communautaire via GitHub.
    value: '1'
  - label: Proposez-vous un Support Téléphonique ?
    content: L'e-mail est le canal principal car il garde l'ID, les captures et les journaux dans un même fil. Les accords Enterprise peuvent inclure des appels planifiés.
    value: '2'
  - label: Pouvez-vous Publier à ma Place ?
    content: Nous pouvons diagnostiquer pourquoi une publication a échoué, mais nous ne publions pas en votre nom. La validation et le contrôle du compte restent chez vous.
    value: '3'
  - label: J'ai Trouvé un Problème de Sécurité. Où le Signaler ?
    content: Écrivez-nous avec l'objet Sécurité et assez de détails pour reproduire. Ne publiez pas de détails d'exploitation avant notre réponse.
    value: '4'
  - label: Le Support Couvre-t-il les Changements de Politique des Plateformes ?
    content: Nous expliquons comment MagicSync gère les changements d'API, mais les suspensions et décisions de politique restent entre vous et la plateforme.
    value: '5'
  - label: Où Puis-je Demander une Fonctionnalité ?
    content: Ouvrez une issue sur GitHub ou envoyez-la via le support. Incluez le flux que vous voulez accomplir, pas seulement le bouton souhaité.
    value: '6'
---

#title
FAQ sur le Support
#subtitle
Délais de réponse, périmètre et comment obtenir une réponse utile rapidement.
::

::BaseCallToAction
---
title: Envoyez-nous les Détails
description: L'ID de publication, la plateforme et l'heure suffisent souvent à tracer les problèmes de publication.
primaryAction:
  label: Écrire au Support
  href: mailto:MagicSync@leamsigc.com
secondaryAction:
  label: Lire la Documentation
  href: /documentation
---
::
