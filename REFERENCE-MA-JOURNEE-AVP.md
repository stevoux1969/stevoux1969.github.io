# Ma Journée AVP — Référence (source de vérité)

Mise à jour : 02/09/2026. Application Android pour ~30 adultes en situation de handicap psychique du service AVP (association La Clé, Rouen). Sert à ne pas rater les rendez-vous : ateliers, rappels personnels, agenda.

Deux dépôts :
- `stevoux1969.github.io` (public, sert l'app en direct) — cloné dans `C:\Users\samsah32\stevoux1969.github.io`
- `majourneeavp-android` (privé, projet Capacitor/Android) — cloné dans `C:\Users\samsah32\Desktop\majourneeavp`, dossier `www/` synchronisé à la main avec le dépôt web

Version en prod (`version.txt`) : **1.0.8**. `APP_VERSION` dans le code web est déjà à **1.0.9** — écart volontaire : les 30 bénéficiaires sont encore sur l'APK 1.0.3 (pré-migration), `install.html` et ses builds successifs restent à usage personnel de Steve. Ne jamais modifier `version.txt` sans son accord explicite.

## Fonctionnalités bénéficiaire (✅ fonctionne)

- Login prénom + PIN 6 chiffres, création de comptes
- Rappels personnels (sonnerie + rendez-vous) via assistant « Nouveau rappel » une question par écran, avec bouton « Modifier » sur un rappel existant
- Synthèse vocale à l'appui sur la carte (plugin text-to-speech APK / speechSynthesis web)
- Alarme plein écran (plugin natif Java maison) + repli notifications locales Capacitor
- Sonnerie unique à l'heure de départ quand un trajet est renseigné (jamais de double alarme, jamais d'alarme à l'heure d'arrivée)
- Planning Steve / Planning Greg depuis Google Sheets CSV, mois à jour (septembre inclus)
- Inscription / désinscription aux ateliers avec règle 3 jours (popup commentaire ≥3j, blocage + appel animateur <3j), et **file d'attente hors-ligne** : si Firestore échoue (pas de connexion), l'action est mémorisée en local et rejouée automatiquement (retour en ligne, ouverture app, retour au premier plan) ; la notif à l'animateur ne part qu'après succès confirmé
- Liste des inscrits visible
- Adresse + temps de trajet + bouton Google Maps : estimation auto par géolocalisation (OpenRouteService) à pied/voiture, repli `navigator.geolocation` hors APK, bus via lien Google Maps transit, choix manuel 10/20/30/45 min toujours en repli
- Widget écran d'accueil : 3 prochains rappels, mise en forme côté JS (natif reste « bête »)
- Thème clair/sombre au choix (tiroir latéral), clair par défaut
- Système d'avis enrichi : deux avis séparés (app / AVP) avec note emoji, liste publique sans modération, stats globales
- Tutoriel guidé interactif (doigt sur les vrais boutons + mascotte animée, 8 expressions) pour créer un premier rappel : reprise à l'étape quittée, suppression uniquement via une vraie leçon (pas automatique), bouton Fermer visible tout du long, nettoyage correct si on sort par le bouton Retour Android
- Bulles de tutoriel sur planning, avis bénéficiaire, avis
- Écran de démarrage (splash) animé, sans mention AVP/La Clé, durée minimale 3 s
- Parcours de configuration guidée (`reglages.html?guide=1`), proposé auto ~4 s après connexion, redirection directe sans popup de confirmation : batterie, autostart constructeur, étape MIUI dédiée (Xiaomi/HyperOS, autostart fusionné dedans), position, notifications, fenêtres superposées, voix, widget
- Bouton retour Android intercepté globalement (`history.pushState`/`popstate`) : recule d'une étape dans le wizard/tutoriel/guide au lieu de fermer l'écran

## Fonctionnalités admin (✅ fonctionne)

- Codes admin Steve (196969) / Greg (555888)
- Créer / voir / éditer / supprimer un bénéficiaire
- **Inscrits aux ateliers** : dropdown avec historique complet des mois (plus limité au mois courant) — liste tous les mois présents dans `AVP_CSV_URLS`/`GREG_CSV_URLS` + le mois en cours ; `loadAVPMonthEvents()` fetch/parse le CSV du mois sélectionné à la demande, avec cache par animateur+mois (`state.avpEventsByMonth`)
- Inscription en parallèle avec erreurs visibles, annulation d'atelier (flag `annule` propagé aux reminders bénéficiaires, réconcilié dans les deux sens avec la collection `annulations` à chaque connexion)
- Message à tous / aux inscrits d'un atelier, écran « Messages envoyés » avec date de fin optionnelle
- Statistiques de présence avec export PDF (jsPDF + html2canvas)
- Bilan trimestriel séparé des Statistiques, avec vue annuelle et badge « Nouveau »
- Avis bénéficiaires sur les ateliers passés, filtrés par animateur
- Pointage présence/absence
- Repère version APK (pastille + compteur), enregistré à la connexion (`appVersion`/`appVersionAt` sur `users`)
- Notifs animateur à l'inscription/désinscription : écrites dans 2 collections, `notifications` (OneSignal web) + `notifs_animateur` (FCM APK), envoyées seulement après succès confirmé de l'écriture Firestore
- Espace Admin repensé : fond `#dadde8` (clair, lisible), cartes blanches uniformes, actions en liste 1 colonne (plus de grille 2 colonnes)

## Bugs corrigés récemment (ne pas réintroduire)

- **Pipeline FCM animateur** (`Code.js`, Google Apps Script, dépôt séparé non versionné dans `Desktop/majourneeavp-apps-script`) : passé d'un simple GET de collection (ordre arbitraire + filtre côté client) à une requête structurée Firestore (`documents:runQuery`) avec filtre serveur `sent==false` et tri `createdAt ASC`. **Fonctionne**, mais le fichier contient encore l'ancienne implémentation en code mort : `sendAnimateurNotifications`, `getFCMToken`, `sendFCMv1`, `markAnimNotifSent` sont chacune définies deux fois dans le fichier — la deuxième définition écrase la première donc ça marche, mais c'est fragile (toute édition de la mauvaise copie ne ferait rien). Nettoyage à faire, voir Chantiers.
- `planning-print.html` : regex de détection de début de mois décalé ne couvrait que « Lundi » → ajout de Mercredi/Jeudi/Vendredi puis du cas Mardi (mois démarrant un mardi).
- Nettoyage du tutoriel guidé (bouton Fermer + retour app Android) : ne laissait plus le guide dans un état zombie.
- Trajet à pied/voiture : échecs intermittents en cliquant vite entre les modes.
- `fermerGuide()` dans `reglages.html` redirige correctement vers `index.html` (bouton « Terminer » et bouton fermer X).
- Dropdown « Inscrits aux ateliers » n'est plus limité au mois courant (détaillé ci-dessus).

## Chantiers ouverts / à venir

- Nettoyer le code mort dupliqué dans `Code.js` (Apps Script) — 4 fonctions définies deux fois, garder uniquement la version avec requête structurée.
- Sécurisation des règles Firestore (actuellement ouvertes, pas d'authentification Firebase — l'app cesserait de fonctionner si on les ferme sans plan préalable). Chantier séparé.
- Suppression de la map `inscriptions` sur `users` (`reminders` est déjà la source canonique, la map n'est plus qu'un filet de sécurité en écriture).
- FCM bénéficiaires app fermée (aujourd'hui seuls OneSignal web + notifications locales Capacitor couvrent ce cas côté bénéficiaire).
- Play Store, iOS.
- Bouton de dictée vocale (`voice-btn`) masqué temporairement sur `index.html` et `index-test.html` — décision à prendre : réactiver ou retirer définitivement.
- `install.html` et l'APK qu'elle propose restent à usage personnel de Steve tant que les bénéficiaires ne sont pas migrés au-delà de la 1.0.3 — ne jamais toucher `version.txt` sans son accord explicite au moment précis.

## Règles de travail avec Steve (IMPÉRATIF)

- Présenter le plan et attendre l'accord explicite avant d'écrire du code.
- Maquette visuelle avant tout changement d'interface.
- Demander l'accord avant : toute action qui risque de supprimer des données, toute dépense ou service payant, toute décision pour laquelle une info manque.
- **Ne jamais modifier `version.txt` sans accord explicite, à chaque fois** — ça déclenche le signal de mise à jour chez les bénéficiaires déjà sur APK.
- Répondre en français, tutoyer Steve.
- Ne jamais afficher de code. Expliquer en 1-2 phrases ce qui est fait et pourquoi.
- Dire seulement ce que Steve doit faire concrètement de son côté.
- Réponses courtes, sans remplissage. Ne pas flatter : dire clairement si une idée est mauvaise, risquée ou incomplète.
- Corriger la cause racine, jamais le symptôme.
- `git push` toujours autorisé sans confirmation, y compris sur `stevoux1969.github.io` (public, sert l'app aux 30 bénéficiaires).
- La stabilité est prioritaire sur la nouveauté.
- Steve teste exclusivement sur Android, jamais sur la version web — tester réellement sur téléphone (adb reverse) avant tout push sur `main`.
- **À la fin de toute session où un changement notable a été fait sur l'appli (bug corrigé, fonctionnalité ajoutée/modifiée), mettre à jour ce fichier avant de terminer la session, même sans demande explicite de Steve.**
