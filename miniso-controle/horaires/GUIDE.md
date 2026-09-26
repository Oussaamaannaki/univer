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

## Étape 2 — Activer les comptes (courriel et Google)

**Lien direct :** https://console.firebase.google.com/project/_/authentication/providers
(Firebase vous demande de choisir le projet : cliquez sur `miniso-horaires-cah5`.)

Sinon, par le menu : dans la colonne de gauche, ouvrez **Catégories de produits** → **Créer** (ou *Build*) → **Authentication**.

1. Si un bouton **Commencer** (*Get started*) apparaît, cliquez dessus.
2. Vous êtes dans l'onglet **Mode de connexion** (*Sign-in method*), qui affiche une liste de fournisseurs.
3. **Courriel** : cliquez sur **Adresse e-mail/Mot de passe** (*Email/Password*), activez le **premier** interrupteur seulement, puis **Enregistrer**.
4. **Google** : cliquez sur **Ajouter un fournisseur** (*Add new provider*) → **Google** → activez l'interrupteur.
   - **Nom public du projet** : `MINISO Horaires CAH5`. C'est ce qu'affichera Google aux employés.
   - **Adresse e-mail d'assistance** : choisissez votre Gmail.
   - Cliquez sur **Enregistrer**.
5. Onglet **Paramètres** (*Settings*) → **Domaines autorisés** (*Authorized domains*) → **Ajouter un domaine** → `miniso-cah5-granby.vercel.app` → **Ajouter**.

À la fin, la liste des fournisseurs doit afficher **Adresse e-mail/Mot de passe : Activé** et **Google : Activé**.

## Étape 3 — Créer la base de données

**Lien direct :** https://console.firebase.google.com/project/_/firestore

1. Si vous passez par le menu : **Créer** → **Firestore Database**.
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

**Lien direct :** https://console.firebase.google.com/project/_/settings/general

1. Sinon : en haut à gauche, cliquez sur l'engrenage ⚙️ à côté de « Vue d'ensemble du projet » → **Paramètres du projet**.
2. Descendez jusqu'à **Vos applications**, puis cliquez sur l'icône **Web** `</>`.
3. Surnom de l'application : `Horaires CAH5`. Ne cochez **pas** Firebase Hosting. Cliquez sur **Enregistrer l'application**.
4. Un bloc de code apparaît, qui contient `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
5. **Copiez ce bloc** (de `const firebaseConfig` jusqu'à `};`) et **envoyez-le-moi**.

Ces valeurs ne sont pas secrètes : elles identifient seulement votre projet. La sécurité vient des règles de l'étape 4.

Je les ajoute à l'application et je la republie : c'est en ligne en moins d'une minute.

---

## Étape 6 — Premier démarrage (après ma confirmation)

1. Ouvrez **https://miniso-cah5-granby.vercel.app/horaires/**.
2. Appuyez sur **Continuer avec Google** et choisissez **annakioussama99@gmail.com**. Ce compte est reconnu comme **propriétaire** et obtient tout de suite l'accès gérant : bâtir, modifier et publier l'horaire, approuver les comptes, les congés et les échanges.
3. (Vous pouvez aussi créer un compte avec ce courriel et un mot de passe : il faudra alors confirmer le courriel reçu.)
4. Onglet **Compte** → **Réglages du magasin** : vérifiez les postes (Caisse, Plancher…) et les quarts types (Ouverture 9 h – 17 h…) selon les heures des Galeries de Granby. Cliquez sur **Enregistrer les réglages**.
5. Onglet **Équipe** → **Copier** le lien d'inscription, puis envoyez-le à l'équipe (texto, Messenger, courriel du magasin).
6. Chaque employé crée son compte. Vous l'approuvez dans **Équipe**, avec son poste et son taux horaire.
7. Demandez à l'équipe de remplir ses **disponibilités** dans l'onglet **Demandes**.
8. **Horaire** : bâtissez la semaine avec « + », puis **Publier l'horaire**. Publiez au moins 5 jours d'avance (normes du travail).

## Sur le téléphone

Ouvrez le lien dans Safari, puis **Partager → Sur l'écran d'accueil**. L'icône « Horaires CAH5 » apparaît, séparée de l'application Chemin de contrôle.
