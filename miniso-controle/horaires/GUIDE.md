# MINISO · Horaires — mise en service (15 minutes, sur ordinateur)

L'application d'horaires est déjà en ligne à l'adresse **https://miniso-cah5-granby.vercel.app/horaires/**.
Pour l'instant, elle affiche « Configuration en cours » : il faut lui créer sa base de données et son système de comptes, avec **Firebase**, un service gratuit de Google.

Faites ces étapes sur l'ordinateur, dans une **fenêtre privée** connectée à **un seul compte Google** (comme pour le Google Sheet) :
- Firefox : `Ctrl + Maj + P`
- Chrome / Edge : `Ctrl + Maj + N`

---

## Étape 1 — Créer le projet Firebase

1. Allez sur **https://console.firebase.google.com** et connectez-vous avec **annakioussama99@gmail.com**.
2. Cliquez sur **Créer un projet** (ou **Ajouter un projet**).
3. Nom du projet : `miniso-horaires-cah5`. Acceptez les conditions, puis cliquez sur **Continuer**.
4. Si on vous propose **Gemini** ou **Google Analytics** : **désactivez**, puis **Continuer** / **Créer le projet**.
5. Attendez environ 30 secondes, puis cliquez sur **Continuer**.

Le forfait gratuit (Spark) suffit largement. Ne donnez aucune carte de crédit.

## Étape 2 — Activer les comptes (courriel + mot de passe)

1. Dans le menu de gauche : **Créer** (ou *Build*) → **Authentication**.
2. Cliquez sur **Commencer**.
3. Dans l'onglet **Mode de connexion**, cliquez sur **Adresse e-mail/Mot de passe**.
4. Activez le **premier** interrupteur (Adresse e-mail/Mot de passe). Laissez « Lien envoyé par e-mail » désactivé.
5. Cliquez sur **Enregistrer**.
6. Onglet **Paramètres** → **Domaines autorisés** → **Ajouter un domaine** → tapez `miniso-cah5-granby.vercel.app` → **Ajouter**.
   (Cela permet aux liens des courriels « mot de passe oublié » de ramener vers l'application.)

## Étape 3 — Créer la base de données

1. Menu de gauche : **Créer** → **Firestore Database**.
2. Cliquez sur **Créer une base de données**.
3. Si on vous demande une édition, choisissez **Standard**.
4. **Emplacement** : choisissez **northamerica-northeast1 (Montréal)**. Les données de vos employés restent ainsi au Québec. Cet emplacement ne peut plus être changé ensuite.
5. Choisissez **Démarrer en mode production**, puis cliquez sur **Créer**.

## Étape 4 — Coller les règles de sécurité

Ces règles décident qui voit quoi : un employé ne voit jamais le taux horaire d'un collègue, un compte non approuvé ne voit rien, etc.

1. Ouvrez **https://github.com/Oussaamaannaki/miniso-controle/blob/main/horaires/firestore.rules** dans un autre onglet, puis cliquez sur l'icône **Copier** (deux carrés, en haut à droite du code).
2. Revenez à Firebase : **Firestore Database** → onglet **Règles**.
3. Effacez tout le texte de l'éditeur (`Ctrl + A`, puis `Suppr`), puis collez (`Ctrl + V`).
4. Cliquez sur **Publier**.

## Étape 5 — Relier l'application

1. En haut à gauche, cliquez sur l'engrenage ⚙️ à côté de « Vue d'ensemble du projet » → **Paramètres du projet**.
2. Descendez jusqu'à **Vos applications**, puis cliquez sur l'icône **Web** `</>`.
3. Surnom de l'application : `Horaires CAH5`. Ne cochez **pas** Firebase Hosting. Cliquez sur **Enregistrer l'application**.
4. Un bloc de code apparaît, qui contient `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
5. **Copiez ce bloc** (de `const firebaseConfig` jusqu'à `};`) et **envoyez-le-moi**.

Ces valeurs ne sont pas secrètes : elles identifient seulement votre projet. La sécurité vient des règles de l'étape 4.

Je les ajoute à l'application et je la republie : c'est en ligne en moins d'une minute.

---

## Étape 6 — Premier démarrage (après ma confirmation)

1. Ouvrez **https://miniso-cah5-granby.vercel.app/horaires/**.
2. **Créer un compte** avec **annakioussama99@gmail.com**. Ce courriel est reconnu comme **propriétaire**.
3. Ouvrez le courriel de confirmation (vérifiez les courriels indésirables), cliquez sur le lien, puis revenez sur l'application et appuyez sur **J'ai confirmé mon courriel**. Vous obtenez l'accès gérant.
4. Onglet **Compte** → **Réglages du magasin** : vérifiez les postes (Caisse, Plancher…) et les quarts types (Ouverture 9 h – 17 h…) selon les heures des Galeries de Granby. Cliquez sur **Enregistrer les réglages**.
5. Onglet **Équipe** → **Copier** le lien d'inscription, puis envoyez-le à l'équipe (texto, Messenger, courriel du magasin).
6. Chaque employé crée son compte. Vous l'approuvez dans **Équipe**, avec son poste et son taux horaire.
7. Demandez à l'équipe de remplir ses **disponibilités** dans l'onglet **Demandes**.
8. **Horaire** : bâtissez la semaine avec « + », puis **Publier l'horaire**. Publiez au moins 5 jours d'avance (normes du travail).

## Sur le téléphone

Ouvrez le lien dans Safari, puis **Partager → Sur l'écran d'accueil**. L'icône « Horaires CAH5 » apparaît, séparée de l'application Chemin de contrôle.
