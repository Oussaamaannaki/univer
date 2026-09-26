/*
 * MINISO · Horaires — configuration.
 * Collez ici la configuration Firebase (voir GUIDE.md, étape 5), puis republiez.
 */
window.HORAIRES_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyDPppcThkHBh8pdYmkiyv-SFBwoMG3y_OE',
    authDomain: 'miniso-horaires-cah5.firebaseapp.com',
    projectId: 'miniso-horaires-cah5',
    storageBucket: 'miniso-horaires-cah5.firebasestorage.app',
    messagingSenderId: '31960070364',
    appId: '1:31960070364:web:4e39c04bd939c339b21c19'
  },

  // Compte propriétaire : ce courriel devient automatiquement gérant après confirmation.
  // Doit être identique au courriel inscrit dans firestore.rules.
  ownerEmail: 'annakioussama99@gmail.com',

  // Bouton « Continuer avec Google » (activer Google dans Firebase > Authentication)
  googleSignIn: true,
  // Adresse du site : la connexion Google de l'app installée passe par ce domaine (voir vercel.json)
  authProxyHost: 'miniso-cah5-granby.vercel.app',

  store: { code: 'CAH5', name: 'Galeries de Granby' },

  // Premier jour de la semaine d'horaire : 0 = dimanche, 1 = lundi. Ne pas changer après le premier horaire.
  weekStartsOn: 0,

  // Tests seulement : utilise les émulateurs Firebase locaux
  emulator: false
};
