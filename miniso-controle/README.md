# MINISO · Chemin de contrôle — CAH5 Galeries de Granby

Application web de contrôle du magasin, à ouvrir sur un téléphone, une tablette ou l'ordinateur du magasin. Les employés n'ont besoin d'aucun compte : il suffit d'ouvrir le lien.

## Contenu

- **Chemin de contrôle quotidien** : 12 sections et 62 points (façade, accueil, plancher, collaborations, beauté, électronique, caisse et PCI DSS, réserve, sécurité, salle des employés, gestion, fermeture).
  - Pour chaque point : Conforme, Non conforme ou S.O., une note et une photo.
  - L'écart de caisse hors de ±5 $ est marqué non conforme automatiquement.
  - Chaque non-conformité reçoit un plan d'action : un employé assigné et une échéance.
- **Menu** comme l'application de référence :
  - **Communications** : messages de la direction à l'équipe.
  - **Ressources gérant** : procédures d'ouverture, de fermeture, de réception et PCI DSS, et les contacts.
  - **Rapports et suivi** : score moyen, tendance, actions ouvertes ou en retard, suivi par employé, historique.
  - **Visite superviseur** (protégée par NIP) : visite mensuelle (indicateurs, visuel, inventaire, RH, conformité), visite surprise, gestion de l'équipe et publication de messages.
- **Envoi du rapport** : sur téléphone, le rapport s'ouvre dans le partage iOS ou Android avec les photos (Courriel, Outlook, Teams…). Sinon, un courriel adressé à `cah5@miniso.ca` est préparé.
- Boutons **Imprimer / PDF** et **Copier**.
- Interface **français / anglais** (bouton FR/EN).
- Les brouillons sont enregistrés automatiquement, et l'application fonctionne hors ligne.

## 1. Mettre en ligne (Vercel, gratuit)

1. Allez sur <https://vercel.com> et connectez-vous avec GitHub.
2. Cliquez sur **Add New → Project** et importez le dépôt `univer`.
3. Dans **Root Directory**, choisissez `miniso-controle`. Pour **Framework Preset**, choisissez **Other**. N'ajoutez aucune commande de build.
4. Cliquez sur **Deploy**. Vous obtenez une adresse du type `https://miniso-cah5.vercel.app`, que vous pouvez renommer dans les réglages du projet (Settings → Domains).

Pour une mise en ligne sans GitHub : glissez le dossier `miniso-controle` sur <https://app.netlify.com/drop>.

## 2. Suivi d'équipe partagé (Google Sheets) — recommandé

Sans cette étape, chaque appareil garde ses propres rapports. Avec elle, tous les rapports, photos et actions arrivent dans **un seul Google Sheet** que vous consultez, et l'application les affiche sur tous les appareils.

1. Créez un Google Sheet vide nommé `MINISO CAH5 — Chemin de contrôle`.
2. Ouvrez **Extensions → Apps Script**. Effacez le contenu et collez tout le fichier `apps-script/Code.gs`.
3. Changez `SUPERVISOR_PIN` (et, si vous le souhaitez, `TEAM_KEY`). Enregistrez.
4. Cliquez sur **Déployer → Nouveau déploiement → Application Web**. Réglez **Exécuter en tant que : Moi** et **Qui a accès : Tout le monde**. Autorisez l'accès.
5. Copiez l'adresse qui se termine par `/exec`.
6. Dans `config.js`, collez-la dans `syncUrl`, puis mettez le même NIP et la même clé que dans le script. Redéployez sur Vercel.

Le Sheet contient les onglets **Rapports**, **Actions**, **Messages** et **Config**. Les photos sont rangées dans le dossier Drive `MINISO Chemin de contrôle — Photos`.

## 3. Avant de partager le lien

- Changez le **NIP superviseur** (`supervisorPin` dans `config.js`, et `SUPERVISOR_PIN` dans le script). Le NIP par défaut est `2580`.
- Vérifiez la liste des **employés** et les **contacts** dans `config.js`.
- Sur chaque téléphone : ouvrez le lien, puis **Partager → Sur l'écran d'accueil**. L'application s'ouvre alors en plein écran avec l'icône MINISO.

## Modifier les points de contrôle

Les listes sont dans `data.js` (`DAILY` pour le quotidien, `MONTHLY` pour la visite mensuelle). Chaque point a un code, un texte français et un texte anglais.
