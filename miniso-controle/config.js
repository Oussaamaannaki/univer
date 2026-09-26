/*
 * Configuration du magasin — modifiez ce fichier puis redéployez.
 * Store configuration — edit this file, then redeploy.
 */
window.APP_CONFIG = {
  // Magasin(s) couvert(s) par l'application
  stores: [
    { code: 'CAH5', name: 'Galeries de Granby', city: 'Granby, QC' }
  ],

  // Courriel qui reçoit les rapports (bouton « Envoyer le rapport »)
  reportEmail: 'cah5@miniso.ca',

  // Seuil de conformité (%) — sous ce score, le rapport est marqué « Action requise »
  threshold: 85,

  // NIP de la section « Visite superviseur ». CHANGEZ-LE avant de partager le lien.
  supervisorPin: '1312',

  // Synchronisation d'équipe (Google Sheets). Laissez vide pour un usage sur un seul appareil.
  // Voir README.md, étape 2, pour obtenir cette adresse.
  syncUrl: 'https://script.google.com/macros/s/AKfycbzGsfRkIvzWIu837ln1hIuls9ZAbCPD1_oOpIMh5RVNbN-s04ytFGhiBwFWDZJqnqqE/exec',
  // Clé partagée avec le script Google (même valeur que TEAM_KEY dans Code.gs)
  teamKey: 'cah5-granby',

  // Équipe (modifiable aussi depuis Visite superviseur > Réglages)
  employees: [
    { name: 'Oussama Annaki', role: 'Directeur de magasin' },
    { name: 'Caro', role: 'Associé(e) en magasin' },
    { name: 'Billy', role: 'Associé(e) en magasin' },
    { name: 'Lana Martel', role: 'Associée en magasin' },
    { name: 'Laurence Lussier', role: 'Associée en magasin' },
    { name: 'Dilan St-André', role: 'Associé en magasin' }
  ],

  // Ressources du gérant (liens, procédures, contacts)
  contacts: [
    { label: 'Magasin CAH5 — Galeries de Granby', value: 'cah5@miniso.ca' },
    { label: 'Ressources humaines', value: 'hr@miniso.ca' },
    { label: 'Paie et avantages sociaux', value: 'hrpayroll@miniso.ca' },
    { label: 'Siège social MINISO Canada', value: '520-5775 Yonge Street, Toronto, ON' }
  ],
  links: [
    // { label: 'Guide promo en cours', url: 'https://...' }
  ]
};
