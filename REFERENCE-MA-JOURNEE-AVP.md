# Ma Journée AVP — Référence (source de vérité)

Mise à jour : 11/10/2026. Application Android pour ~30 adultes en situation de handicap psychique du service AVP (association La Clé, Rouen). Sert à ne pas rater les rendez-vous : ateliers, rappels personnels, agenda.

Deux dépôts :
- `stevoux1969.github.io` (public, sert l'app en direct) — cloné dans `C:\Users\samsah32\stevoux1969.github.io`
- `majourneeavp-android` (privé, projet Capacitor/Android) — cloné dans `C:\Users\samsah32\Desktop\majourneeavp`, dossier `www/` synchronisé à la main avec le dépôt web

Version en prod (`version.txt`) et `APP_VERSION` dans le code web : **1.0.10** (synchronisés le 18/09/2026, accord explicite de Steve — sonnerie atelier, bouton Réglages, maj obligatoire). Les 30 bénéficiaires sont encore sur l'APK 1.0.3 (pré-migration) et ne voient donc pas cette mise à jour ; `install.html` et ses builds successifs restent à usage personnel de Steve. Ne jamais modifier `version.txt` sans son accord explicite.

## Fonctionnalités bénéficiaire (✅ fonctionne)

- Login prénom + PIN 6 chiffres, création de comptes
- Rappels personnels (sonnerie + rendez-vous) via assistant « Nouveau rappel » une question par écran, avec bouton « Modifier » sur un rappel existant
- Synthèse vocale à l'appui sur la carte (plugin text-to-speech APK / speechSynthesis web)
- Alarme plein écran (plugin natif Java maison) + repli notifications locales Capacitor
- Sonnerie unique à l'heure de départ quand un trajet est renseigné (jamais de double alarme, jamais d'alarme à l'heure d'arrivée)
- Planning Steve / Planning Greg depuis Google Sheets CSV, mois à jour (septembre inclus). Chaque carte affiche un aperçu croisé : bloc « Vous avez déjà » (rappels perso + ateliers déjà inscrits ce jour-là, Steve et Greg confondus, toujours visible si contenu) et bandeau repliable « [Autre animateur] propose aussi ce jour-là » listant les ateliers de l'autre animateur pas encore choisis, avec inscription directe
- Bouton audio dédié sur chaque carte de planning (44×44 min), lecture/arrêt indépendant par carte (même mécanisme que les cartes de rappel) — remplace l'ancien tap sur toute la carte qui ne pouvait pas être arrêté
- Inscription / désinscription aux ateliers avec règle 3 jours (popup commentaire ≥3j, blocage + appel animateur <3j), et **file d'attente hors-ligne** : si Firestore échoue (pas de connexion), l'action est mémorisée en local et rejouée automatiquement (retour en ligne, ouverture app, retour au premier plan) ; la notif à l'animateur ne part qu'après succès confirmé
- Liste des inscrits visible
- Adresse + temps de trajet + bouton Google Maps : estimation auto par géolocalisation (OpenRouteService) à pied/voiture, repli `navigator.geolocation` hors APK, bus via lien Google Maps transit, choix manuel 10/20/30/45 min toujours en repli
- Widget écran d'accueil : 3 prochains rappels, mise en forme côté JS (natif reste « bête »)
- Thème clair/sombre au choix (tiroir latéral), clair par défaut. Languette d'ouverture du tiroir redessinée (34px, fond plein, label vertical « Réglages ») pour être plus visible qu'avant (poussé le 18/09/2026, était en chantier local depuis plusieurs sessions)
- Système d'avis enrichi : deux avis séparés (app / AVP) avec note emoji, liste publique sans modération, stats globales
- Tutoriel guidé interactif (doigt sur les vrais boutons + mascotte animée, 8 expressions) pour créer un premier rappel : reprise à l'étape quittée, suppression uniquement via une vraie leçon (pas automatique), bouton Fermer visible tout du long, nettoyage correct si on sort par le bouton Retour Android
- Bulles de tutoriel sur planning, avis bénéficiaire, avis
- Écran de démarrage (splash) animé, sans mention AVP/La Clé, durée minimale 3 s
- Parcours de configuration guidée (`reglages.html?guide=1`), proposé auto ~4 s après connexion, redirection directe sans popup de confirmation : batterie, autostart constructeur, étape MIUI dédiée (Xiaomi/HyperOS, autostart fusionné dedans), position, notifications, fenêtres superposées, voix, widget
- Bouton retour Android intercepté globalement (`history.pushState`/`popstate`) : recule d'une étape dans le wizard/tutoriel/guide au lieu de fermer l'écran
- Mise à jour automatique **obligatoire** : `checkUpdate()` (compare `APP_VERSION` à `version.txt`) se relance à chaque retour au premier plan via `App.addListener('resume', …)` (plugin Capacitor App), pas seulement au démarrage. `showUpdatePopup()` affiche un écran plein bleu bloquant (icône 🔄, badge « Message de Steve », sans bouton, sans fermeture), qui se recharge tout seul après ~3s (`location.href` anti-cache). Anti-spam `localStorage` (`update_seen_`+version) inchangé.

## Fonctionnalités admin (✅ fonctionne)

- Codes admin Steve (196969) / Greg (555888)
- Créer / voir / éditer / supprimer un bénéficiaire
- **Inscrits aux ateliers** : dropdown avec historique complet des mois (plus limité au mois courant) — liste tous les mois présents dans `AVP_CSV_URLS`/`GREG_CSV_URLS` + le mois en cours ; `loadAVPMonthEvents()` fetch/parse le CSV du mois sélectionné à la demande, avec cache par animateur+mois (`state.avpEventsByMonth`)
- Inscription en parallèle avec erreurs visibles, annulation d'atelier (flag `annule` propagé aux reminders bénéficiaires, réconcilié dans les deux sens avec la collection `annulations` à chaque connexion)
- Message à tous / aux inscrits d'un atelier, écran « Messages envoyés » avec date de fin optionnelle
- Statistiques de présence avec export PDF (jsPDF + html2canvas)
- Bilan trimestriel séparé des Statistiques, avec vue annuelle et badge « Nouveau »
- **Exclusion de comptes des Statistiques/Bilans** (bouton « Choisir qui compte dans les stats », visible pour Steve uniquement, cachée pour Greg) : liste commune `config/statsExclusions` (`{ids:[...uid], updatedAt}`), un compte exclu l'est à la fois pour Steve et pour Greg, dans les Statistiques comme dans le Bilan trimestriel/annuel et leurs exports PDF. Identifiant utilisé : l'uid Firestore du document `users` (stable, contrairement au prénom). Pré-rempli au lancement avec les comptes non-bénéficiaires repérés dans les données réelles : Test, Steve, Admin, Sophie, Sads, Accueil la clé.
- Avis bénéficiaires sur les ateliers passés, filtrés par animateur
- Pointage présence/absence
- Repère version APK (pastille + compteur), enregistré à la connexion (`appVersion`/`appVersionAt` sur `users`)
- Notifs animateur à l'inscription/désinscription : écrites dans 2 collections, `notifications` (OneSignal web) + `notifs_animateur` (FCM APK), envoyées seulement après succès confirmé de l'écriture Firestore
- Espace Admin repensé : fond `#dadde8` (clair, lisible), cartes blanches uniformes, actions en liste 1 colonne (plus de grille 2 colonnes)
- **Aperçu compte Test depuis l'Espace Admin** (Steve ou Greg uniquement) : section « 👁️ Aperçu », bouton « 👁️ Voir comme Test » tout en haut (`voirCommeTest()`, index.html) — ouvre le compte bénéficiaire « Test » (trouvé par prénom dans `users`) exactement comme une connexion normale, sans ressaisir de code. Mémorise sur l'appareil qui doit revenir via la clé `localStorage` `avp_retour_admin` (valeur `"steve"` ou `"greg"`, jamais de code/PIN). Le bouton « ↩ Retour admin » apparaît tout en haut de `reglages.html` (le tiroir « Réglages ») uniquement si cette clé existe ET que le compte connecté est « Test » ; il rétablit la session admin (Steve/Greg selon la clé) et supprime la clé. La clé est aussi supprimée par `clearSession()` (déconnexion) et au début de `handleLogin()` (toute connexion manuelle), pour ne jamais laisser le bouton apparaître en dehors de ce parcours.
- **Inscription aux ateliers (« Inscrire au groupe ») repensée par jour** (`showAdminInscrireGroupe()` + `renderAdminGroupeJour()`, index.html) : l'écran s'ouvre sur aujourd'hui (barre bleue `#2c3e91` avec flèches ‹ › réutilisant le style de l'accueil, `state.admGroupeOffset`, remis à 0 à chaque entrée depuis le menu admin), un jour sans atelier affiche « Aucun atelier ce jour-là. ». Chaque atelier du jour est une carte repliée par défaut (titre bleu + « HH:MM · N inscrit(s) ») ; clic sur le titre = ouverture (bordure bleue, un seul atelier ouvert à la fois), liste des bénéficiaires + cases à cocher révélées en CSS (`display:none`/`block`, jamais reconstruites) pour garder les cases cochées non validées en cas de fermeture/réouverture ou de changement de jour. Compteur d'inscrits mis à jour en direct au cochage. Filtrage Steve/Greg (`state.currentAnim`/`loadAVPPlanning()`) et bouton/logique « Valider les inscriptions » (`validerInscriptionsGroupe()`) strictement inchangés.

## Bugs corrigés récemment (ne pas réintroduire)

- **Sous-comptage des présences aux ateliers (Statistiques + Bilan)** — deux bugs distincts, diagnostiqués le 19/10/2026 sur les vraies données, corrigés le même jour :
  - **Bug A** (le plus grave) : `adminInscrireAtelier()` (écran « 📋 Inscrire à un atelier » de la fiche bénéficiaire) remplaçait TOUT le tableau `reminders`/`inscriptions` par la seule sélection visible dans son sélecteur (mois affiché, à partir d'aujourd'hui) au lieu de fusionner — chaque utilisation effaçait silencieusement tout l'historique antérieur (autres mois, dates passées) du bénéficiaire. Corrigé sur le modèle de `validerInscriptionsGroupe()` (déjà sûr) : relecture fraîche juste avant l'écriture, ne touche que les ateliers visibles dans le sélecteur, conserve intégralement le reste ; garde-fou qui annule l'écriture si le total après coup est incohérent. **Données perdues, non récupérables depuis l'appli** (tableau réellement écrasé dans Firestore, pas de corbeille) : l'historique avril-septembre 2026 de **Gaëtan LO.** est perdu (ne reste que octobre) ; même signature suspectée chez **Francois LO., Mathilde M., Philippe R.** (démarrage brutal récent, rien avant, alors que leur compte existe depuis la même date que les autres).
  - **Bug B** : Statistiques et Bilan ne comptaient une présence que si la clé exacte `date+heure+titre(20 car.)` du rappel existait dans le planning CSV ACTUEL (`buildAnimAtelierIndex`) — or le Google Sheet est corrigé après coup (horaire/libellé), ce qui orpheline pour toujours les rappels déjà enregistrés avec l'ancienne version, sans aucune erreur visible. Mesuré : 36 présences passées orphelines sur 422 côté Steve (8,5%). Corrigé par `matchAtelierPlanning()` (fonction partagée, Statistiques + Bilan) : en plus de la clé exacte, tolère une correspondance par date + titre normalisé (accents/casse/émojis ignorés) SEULEMENT si un seul atelier de ce planning ce jour-là correspond — sinon ne compte pas (pas de 3ᵉ niveau par simple heure : Steve et Greg réutilisent les mêmes créneaux pour des activités différentes, ça aurait fait basculer des présences d'un planning à l'autre). `parseAVPPlanning` corrigé en même temps pour retirer aussi les émojis en fin de titre (ex. "Pique-nique en forê🧺"). Orphelins restants après correctif : 20/422 (cas plus fins : libellés trop différents pour la comparaison tolérante, ex. "journal AVP" vs "Journal AVP" avec typo). **Ces données-là sont récupérables sans y toucher** : c'était un problème de calcul, pas de perte.
  - Conséquence résiduelle à traiter séparément (demandé explicitement, pas fait ici) : le Bug A a créé des doublons de rappel (même atelier inscrit deux fois à des heures différentes après une correction du planning, ex. Gaëtan/Eric M./Francois LO./Graham sur « Veules-les-Roses journal » le 08/10 à 12h30 ET 13h00) — avec le Bug B corrigé, ces doublons compteront maintenant deux présences pour une seule séance réelle, jusqu'à leur nettoyage manuel.
- **Doublon de sonnerie ateliers** : les ateliers (`source:'atelier'`) programmaient deux alarmes (veille 15h + 2h avant). Retiré la sonnerie veille partout où elle existait — alarme native (`_occurrencesNatives`), repli notification push web (`queueAtelierNotifications`, auto-inscription bénéficiaire), inscription groupée admin par prénom (`adminInscrireAtelier`) — ainsi que le texte affiché sur la carte et la synthèse vocale (`_carteRappel`, `_phraseCarte`), qui annonçaient encore « deux sonneries ». Ne reste qu'une seule alarme, 2h avant. Le choix veille/2h des rappels personnels (assistant « Nouveau rappel ») est une fonctionnalité séparée, volontaire, non touchée.
- **Pipeline FCM animateur** (`Code.js`, Google Apps Script, dépôt séparé non versionné dans `Desktop/majourneeavp-apps-script`) : passé d'un simple GET de collection (ordre arbitraire + filtre côté client) à une requête structurée Firestore (`documents:runQuery`) avec filtre serveur `sent==false` et tri `createdAt ASC`. **Fonctionne**, mais le fichier contient encore l'ancienne implémentation en code mort : `sendAnimateurNotifications`, `getFCMToken`, `sendFCMv1`, `markAnimNotifSent` sont chacune définies deux fois dans le fichier — la deuxième définition écrase la première donc ça marche, mais c'est fragile (toute édition de la mauvaise copie ne ferait rien). Nettoyage à faire, voir Chantiers.
- `planning-print.html` : regex de détection de début de mois décalé ne couvrait que « Lundi » → ajout de Mercredi/Jeudi/Vendredi puis du cas Mardi (mois démarrant un mardi).
- Nettoyage du tutoriel guidé (bouton Fermer + retour app Android) : ne laissait plus le guide dans un état zombie.
- Trajet à pied/voiture : échecs intermittents en cliquant vite entre les modes.
- `fermerGuide()` dans `reglages.html` redirige correctement vers `index.html` (bouton « Terminer » et bouton fermer X).
- Dropdown « Inscrits aux ateliers » n'est plus limité au mois courant (détaillé ci-dessus).

## Assistant vocal IA (« Je le dis ») — test uniquement, build `.test`

Nouveau chemin de création de rappel en voix (rond bleu, maquette `maquette-nouveau-rappel-voix.html`), en plus des tuiles existantes (inchangées). Actif uniquement sur `AVP TEST` (paquet `fr.avplacle.majourneeavp.test`) : sur la prod ou dans un navigateur, le bouton « + » va direct aux tuiles comme avant (gating `Capacitor.isPluginAvailable('Voice'/'Gemma')`). Testé OK par Steve sur son Redmi Note 14 ; prochaine étape = test avec de vrais bénéficiaires.

**Architecture (100 % gratuit, aucun service payant, aucune clé API)** :
- IA : Gemma 4 E2B, exécutée dans le téléphone en CPU (jamais GPU — GPU donne du charabia sur ce Redmi) via LiteRT-LM (`GemmaPlugin.kt`, plugin natif maison, écrit en Kotlin).
- Micro : reconnaissance vocale Android native (`android.speech.SpeechRecognizer`, fr-FR), plugin natif maison `VoicePlugin.java`.
- Voix : plugin `@capacitor-community/text-to-speech` déjà présent dans l'app ; meilleure voix fr-FR **locale** choisie par défaut (hors connexion, cohérent avec une IA qui tourne sans internet), choix manuel dans l'écran « Détails » avec le temps de réponse de l'IA affiché.
- Logique de compréhension portée de `test-ia.html` (prototype abandonné, récupérable via `git show 8673105:test-ia.html` sur ce dépôt) : l'IA renvoie un JSON `{type, quoi, icone, jour, heure, moment, tous_les_jours, parole}` — jour/heure restent les mots bruts dits par la personne, la date et l'heure réelles sont **toujours calculées par le code** (jamais par l'IA). Règlement envoyé une seule fois par conversation, pas à chaque message. `TEXTE_DETRESSE` fixe, jamais généré par l'IA ; plus d'écoute automatique après son affichage.
- Le rappel validé est enregistré via le **même bouton** `#save-btn` que l'assistant tuiles (remplissage des mêmes champs cachés puis déclenchement du clic) — aucune logique de sauvegarde dupliquée.

**Isolation stricte au build `.test`** (zéro impact prod) :
- Classes réelles dans `android/app/src/debug/{java,kotlin}` (`VoicePlugin`, `GemmaPlugin`) ; classes vides de même nom dans `src/release/java` (sinon le projet ne compile pas en release). `MainActivity.onCreate` ne les enregistre que si `BuildConfig.DEBUG` → invisibles pour `Capacitor.isPluginAvailable()` côté bénéficiaires.
- Permission `RECORD_AUDIO` déclarée uniquement dans `android/app/src/debug/AndroidManifest.xml` (jamais fusionnée en release).
- Dépendance LiteRT-LM en `debugImplementation` uniquement.
- Vérifié à chaque étape par recherche binaire dans les `.dex` extraits de l'APK release (un simple listing de fichiers ne voit pas le contenu du dex) : zéro trace de `litertlm`, de `SpeechRecognizer`, ni de la permission `RECORD_AUDIO`.
- Seul effet de bord accepté côté release : `kotlin-stdlib` (quelques centaines de Ko, inerte, aucune permission/comportement nouveau) ajouté par l'outillage Kotlin lui-même — pas scopable par variante avec les outils standards.

**Modèle Gemma sur le téléphone** : `gemma-4-E2B-it.litertlm` (2 588 147 712 octets) n'est **pas téléchargé par l'app**. Copié une seule fois à la main : `adb pull` depuis le cache de Google AI Edge Gallery (`com.google.ai.edge.gallery`, déjà installé sur le Redmi de test) puis `adb push` dans `/sdcard/Android/data/fr.avplacle.majourneeavp.test/files/models/gemma-4-E2B-it.litertlm`. Si ce téléphone est réinitialisé, ou pour tester sur un autre téléphone, il faut repousser ce fichier à la main (le dossier `files/models` n'existe qu'après un premier lancement de l'app installée).

**Reste à tester** : usage avec de vrais bénéficiaires (vocabulaire varié, bruit ambiant, accents), fiabilité du micro sur plusieurs tours de conversation d'affilée, temps de chargement initial du modèle ressenti par un bénéficiaire (pas seulement par Steve), comportement si le modèle est absent sur un autre téléphone de test, et si l'IA retrouve bien les ateliers AVP spécifiques (pas encore mappés aux icônes/adresses exactes de l'app, contrairement à l'assistant tuiles).

## Planning dans l'appli (EN LIGNE depuis le 23/10/2026, planning de Steve uniquement) — remplace peu à peu le Google Sheet

**Objectif** : Steve (puis Greg, puis d'autres services comme le GEM) crée le planning dans une page pro au lieu du Google Sheet ; les bénéficiaires le voient dans l'appli **sans nouvel APK** (l'APK charge le site). Une seule base Firestore, une page pro séparée (pas un 2e APK).

**Fichiers** (`index.html` live lit désormais le planning de l'appli pour les mois PUBLIÉS ; bouton « ✏️ Créer mon planning » dans l'écran admin, section Ateliers et activités, visible pour Steve seulement, qui ouvre `planning-pro.html` ; `reglages.html` et `version.txt` inchangés) :
- `planning-pro.html` — page pro mobile. Accès provisoire par code (`196969` = Steve uniquement, **PAS de vraie sécurité** : règles Firestore ouvertes). Mois par mois : brouillon/publié, ajout/modification/suppression d'ateliers, menu des ateliers habituels (icône automatique, reprise de la dernière description/adresse/heure/places), calendrier, répétition hebdomadaire, places ou illimité. Pas de champ trajet (chacun habite ailleurs). Dates limitées à partir de **novembre 2026** (`MIN_DATE`), octobre et avant restent sur le Sheet.
- `index.html` (live) : ~80 lignes ajoutées, repérables par `[Planning dans l'appli]` et le bloc `// ===== PLANNING DANS L'APPLI =====`. Si la lecture du planning de l'appli échoue : le planning déjà en cache est gardé, sinon retombée sur le Google Sheet (jamais de planning vide).
- `index-planning-test.html` — copie de `index.html` avec pastille « TEST planning » (affiche ce qui est lu dans la base), cache local séparé (`avp_planning_events_T2_`) et cache de 10 s ; sert de bac à sable. Générée à partir de `index.html` par un script de patch (hors dépôt) : à régénérer si `index.html` change.

**Modèle de données (Firestore)** :
- `planning/{auto}` : `{anim:'Steve', ym:'2026-11', date, time, fin, title, icon, limite (nombre ou null = illimité), description, adresse, lien, createdAt, updatedAt}`.
- `config/planningApp` : `{publies:{Steve_2026_11:true,…}}` (clé `Animateur_AAAA_MM`).
- `ateliers_habituels/{Steve|Titre}` : mémoire « dernière fois » `{anim,title,icon,heure,fin,places,description,adresse,lien,liste}` ; `liste:true` = atelier personnalisé ajouté au menu.
- Écriture miroir dans `atelier_descriptions/{descKey(titre,date,heure)}` (`description, adresse, lien, travelMin:0`) : l'affichage bénéficiaire des descriptions n'a **pas changé**. `travelMin` toujours 0 pour les ateliers de l'appli (plus d'alarme « heure de partir » commune à tous).
- Les inscriptions restent dans `users[].reminders` (`source:'atelier'`) avec la même clé `date_heure_titre(20 car.)` : **aucun changement côté inscriptions/annulations/pointage**.

**Règle de bascule (par animateur et par mois)** : si le mois est publié dans l'appli → il remplace le Sheet ; sinon → Google Sheet comme avant. Pour l'instant seul `Steve` est autorisé (`INAPP_ANIMS`) ; Greg reste 100 % Sheet. Fonctions patchées dans la copie de test : `loadAVPPlanning`, `loadAVPMonthEvents` (+ paramètre `ymForce`), `showAdminAteliers` (menu des mois), `buildAnimAtelierIndex` (stats, Bilans, aperçu croisé) ; nouvelles : `getInAppPlanning`, `getInAppMonthEvents`, `inAppEventsOf`.

**Règle de protection** : un atelier qui a des inscrits n'a plus de titre/date/heure de début modifiables et ne peut pas être supprimé depuis la page pro (la clé d'inscription en dépend) — passer par « Annuler un atelier » de l'appli. À valider avec Steve.

**Reste à faire** :
1. Vraie sécurité : Firebase Auth pour les pros + règles Firestore (`planning`, `config/planningApp`, `ateliers_habituels` en écriture réservée aux pros ; lecture libre). Étapes console Firebase possibles avec Steve.
2. ~~Reporter les patchs dans `index.html`~~ FAIT le 23/10/2026 avec l'accord de Steve (testé sur son téléphone via la copie de test). `version.txt` non touché : jamais sans accord explicite de Steve. Rien ne change pour les bénéficiaires tant qu'aucun mois n'est publié depuis la page pro.
3. Décider du filet pour novembre si Greg est absent : le planning de Steve suffit (publié dans l'appli).
4. Non couvert : `planning-print.html` (lit encore les CSV du Sheet), écran Descriptions admin (modifie `atelier_descriptions` mais pas le champ `description` du document `planning` : la page pro relit le document `planning`), ouverture aux autres services (identifiant de service + comptes).

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
