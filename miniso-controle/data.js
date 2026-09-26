/* Listes de contrôle, procédures et textes de l'interface (FR / EN). */
(function () {
  const T = (fr, en) => ({ fr, en });

  // kind: 'check' (défaut) | 'number' (valeur saisie) ; max/min : limites qui rendent le point non conforme
  const DAILY = [
    { id: 'FAC', title: T('Façade et vitrine', 'Storefront & window'), items: [
      ['FAC-01', T('Vitrine propre, sans traces de doigts', 'Window clean, no fingerprints')],
      ['FAC-02', T('Enseigne MINISO allumée', 'MINISO sign lit')],
      ['FAC-03', T('Affiches promo conformes au guide promo en cours', 'Promo posters match the current promo guide')],
      ['FAC-04', T('Vitrine thématique à jour (collaboration en vedette)', 'Themed window up to date (featured collaboration)')],
      ['FAC-05', T('Entrée dégagée, tapis propre et bien placé', 'Entrance clear, mat clean and in place')],
      ['FAC-06', T('Rideau / portes ouverts à l\'heure d\'ouverture du centre', 'Gate / doors open at mall opening time')]
    ]},
    { id: 'ACC', title: T('Accueil et ambiance', 'Greeting & atmosphere'), items: [
      ['ACC-01', T('Client accueilli dans les 5 secondes (« Bonjour, bienvenue chez MINISO »)', 'Customer greeted within 5 seconds')],
      ['ACC-02', T('Musique du magasin en marche, volume adéquat', 'Store music on, proper volume')],
      ['ACC-03', T('Éclairage complet, aucun néon brûlé', 'All lighting on, no burnt-out tubes')],
      ['ACC-04', T('Paniers disponibles à l\'entrée', 'Baskets available at entrance')],
      ['ACC-05', T('Affichage en français conforme (OQLF)', 'French signage compliant (OQLF)')]
    ]},
    { id: 'PLA', title: T('Plancher de vente', 'Sales floor'), items: [
      ['PLA-01', T('Gondoles pleines, aucun trou sur les tablettes', 'Shelves full, no gaps')],
      ['PLA-02', T('Facing fait : produits alignés, étiquettes vers l\'avant', 'Facing done: products aligned, labels forward')],
      ['PLA-03', T('Étiquettes de prix présentes et exactes (changements de prix appliqués)', 'Price tags present and accurate (price changes applied)')],
      ['PLA-04', T('Planogramme respecté', 'Planogram followed')],
      ['PLA-05', T('Allées dégagées, aucune boîte au sol', 'Aisles clear, no boxes on the floor')],
      ['PLA-06', T('Planchers propres, sans taches', 'Floors clean, no stains')]
    ]},
    { id: 'VED', title: T('Nouveautés, collaborations et promos', 'New arrivals, collabs & promos'), items: [
      ['VED-01', T('Zone nouveautés à l\'avant du magasin et remplie', 'New arrivals zone at the front and full')],
      ['VED-02', T('Collaborations (Sanrio, Disney, Harry Potter…) complètes et signalées', 'Collaborations (Sanrio, Disney, Harry Potter…) complete and signed')],
      ['VED-03', T('Blind boxes : présentoir plein, modèles d\'exposition en place', 'Blind boxes: display full, sample figures in place')],
      ['VED-04', T('Peluches rangées par personnage et par taille', 'Plush sorted by character and size')],
      ['VED-05', T('Articles en promotion identifiés selon le guide promo', 'Promo items marked per promo guide')],
      ['VED-06', T('Promo « cadeau avec achat » : cadeaux disponibles en caisse', 'Gift-with-purchase: gifts available at cash')]
    ]},
    { id: 'BEA', title: T('Beauté et parfums', 'Beauty & fragrance'), items: [
      ['BEA-01', T('Testeurs propres et identifiés « Testeur »', 'Testers clean and labelled "Tester"')],
      ['BEA-02', T('Aucun produit expiré (dates vérifiées)', 'No expired products (dates checked)')],
      ['BEA-03', T('Sélection beauté en promo bien signalée', 'Beauty promo selection clearly signed')],
      ['BEA-04', T('Miroirs et présentoirs beauté propres', 'Beauty mirrors and displays clean')]
    ]},
    { id: 'ELE', title: T('Électronique et accessoires', 'Electronics & accessories'), items: [
      ['ELE-01', T('Modèles de démonstration fonctionnels et chargés', 'Demo units working and charged')],
      ['ELE-02', T('Antivols en place sur les articles de valeur', 'Security tags on high-value items')],
      ['ELE-03', T('Écouteurs, câbles et chargeurs rangés par type', 'Headphones, cables, chargers sorted by type')]
    ]},
    { id: 'CAI', title: T('Caisse', 'Cash desk'), items: [
      ['CAI-01', T('Comptoir propre et dégagé', 'Counter clean and clear')],
      ['CAI-02', T('Fond de caisse compté', 'Float counted')],
      ['CAI-03', T('Écart de caisse ($)', 'Cash variance ($)'), { kind: 'number', unit: '$', max: 5, min: -5 }],
      ['CAI-04', T('Terminal de paiement fonctionnel, rouleaux en réserve', 'Payment terminal working, spare rolls')],
      ['CAI-05', T('Sacs en quantité suffisante', 'Enough bags in stock')],
      ['CAI-06', T('Articles d\'impulsion (add-on) remplis', 'Add-on impulse items filled')],
      ['CAI-07', T('Adhésion au programme membre proposée à chaque client', 'Membership offered to every customer')],
      ['CAI-08', T('Résumé des promos affiché en caisse', 'Promo summary posted at cash')],
      ['CAI-09', T('PCI DSS : terminal inspecté (aucune altération), aucun numéro de carte noté', 'PCI DSS: terminal inspected (no tampering), no card numbers written')]
    ]},
    { id: 'RES', title: T('Réserve et réception', 'Stockroom & receiving'), items: [
      ['RES-01', T('Réserve organisée, boîtes identifiées', 'Stockroom organised, boxes labelled')],
      ['RES-02', T('Allées de la réserve dégagées', 'Stockroom aisles clear')],
      ['RES-03', T('Réception traitée : aucun carton en attente depuis plus de 24 h', 'Receiving done: no carton waiting over 24 h')],
      ['RES-04', T('Retours et défectueux isolés et identifiés', 'Returns and damages isolated and labelled')],
      ['RES-05', T('Cartons vides aplatis et sortis au recyclage', 'Empty cartons flattened and recycled')]
    ]},
    { id: 'SEC', title: T('Santé et sécurité', 'Health & safety'), items: [
      ['SEC-01', T('Sorties de secours dégagées et éclairées', 'Emergency exits clear and lit')],
      ['SEC-02', T('Extincteurs accessibles, inspection à jour', 'Extinguishers accessible, inspection current')],
      ['SEC-03', T('Trousse de premiers soins complète', 'First aid kit complete')],
      ['SEC-04', T('Aucun escabeau laissé sur le plancher de vente', 'No step ladder left on sales floor')],
      ['SEC-05', T('Caméras fonctionnelles', 'Cameras working')]
    ]},
    { id: 'EMP', title: T('Salle des employés', 'Staff room'), optional: true, items: [
      ['EMP-01', T('Salle des employés propre', 'Staff room clean')],
      ['EMP-02', T('Babillard à jour (horaire, communications, normes du travail)', 'Board up to date (schedule, memos, labour standards)')],
      ['EMP-03', T('Effets personnels rangés dans les casiers', 'Personal items in lockers')]
    ]},
    { id: 'GES', title: T('Gestion et équipe', 'Management & team'), items: [
      ['GES-01', T('Uniforme et porte-nom portés par toute l\'équipe', 'Uniform and name tag worn by all')],
      ['GES-02', T('Horaire affiché et respecté', 'Schedule posted and followed')],
      ['GES-03', T('Caucus de début de quart fait (objectif de ventes du jour)', 'Shift huddle done (daily sales target)')],
      ['GES-04', T('Guide promo en cours ouvert sur l\'ordinateur du magasin', 'Current promo guide open on store computer')],
      ['GES-05', T('Registre de formation PCI DSS à jour', 'PCI DSS training log up to date')]
    ]},
    { id: 'FER', title: T('Fermeture', 'Closing'), optional: true, items: [
      ['FER-01', T('Caisse fermée, dépôt préparé et sécurisé', 'Register closed, deposit prepared and secured')],
      ['FER-02', T('Plancher remis en ordre (facing de fermeture)', 'Floor recovered (closing facing)')],
      ['FER-03', T('Démos électroniques rangées / sécurisées', 'Electronics demos stored / secured')],
      ['FER-04', T('Lumières et appareils éteints', 'Lights and devices off')],
      ['FER-05', T('Portes verrouillées, rideau fermé, alarme activée', 'Doors locked, gate closed, alarm set')]
    ]}
  ];

  const MONTHLY = [
    { id: 'KPI', title: T('Performance du mois', 'Monthly performance'), items: [
      ['KPI-01', T('Ventes vs objectif (%)', 'Sales vs target (%)'), { kind: 'number', unit: '%', min: 100 }],
      ['KPI-02', T('Taux de conversion (%)', 'Conversion rate (%)'), { kind: 'number', unit: '%', min: 15 }],
      ['KPI-03', T('Panier moyen ($)', 'Average basket ($)'), { kind: 'number', unit: '$' }],
      ['KPI-04', T('Nouvelles adhésions membres', 'New member sign-ups'), { kind: 'number', unit: '' }],
      ['KPI-05', T('Démarque / pertes du mois (%)', 'Shrink for the month (%)'), { kind: 'number', unit: '%', max: 1.5 }]
    ]},
    { id: 'VIS', title: T('Visuel et marchandisage', 'Visual merchandising'), items: [
      ['VIS-01', T('Planogrammes du mois implantés', 'Monthly planograms implemented')],
      ['VIS-02', T('Vitrine et zone avant conformes aux directives du siège', 'Window and front zone per head-office guidelines')],
      ['VIS-03', T('Collaborations en vedette bien mises en valeur', 'Featured collaborations well presented')],
      ['VIS-04', T('Signalisation promo retirée à la fin de chaque promotion', 'Promo signage removed at each promo end')],
      ['VIS-05', T('Rapport des présentoirs restants (fixtures) à jour', 'Remaining fixture report up to date')]
    ]},
    { id: 'INV', title: T('Inventaire', 'Inventory'), items: [
      ['INV-01', T('Comptages cycliques faits selon le calendrier', 'Cycle counts done per calendar')],
      ['INV-02', T('Écarts d\'inventaire expliqués', 'Inventory variances explained')],
      ['INV-03', T('Produits expirés retirés et documentés', 'Expired products pulled and documented')],
      ['INV-04', T('Transferts et retours au siège traités', 'Transfers and returns to head office processed')]
    ]},
    { id: 'RH', title: T('Équipe et RH', 'Team & HR'), items: [
      ['RH-01', T('Dossiers d\'embauche complets et envoyés aux RH', 'Hiring files complete and sent to HR')],
      ['RH-02', T('Formation des nouveaux employés complétée', 'New hire training completed')],
      ['RH-03', T('Formation PCI DSS signée par toute l\'équipe', 'PCI DSS training signed by all')],
      ['RH-04', T('Horaires conformes aux normes du travail (pauses, préavis)', 'Schedules comply with labour standards')],
      ['RH-05', T('Rencontres individuelles / évaluations faites', 'One-on-ones / reviews done')]
    ]},
    { id: 'CON', title: T('Conformité', 'Compliance'), items: [
      ['CON-01', T('Affichage en français conforme (OQLF)', 'French signage compliant (OQLF)')],
      ['CON-02', T('Registre santé et sécurité à jour', 'Health and safety log up to date')],
      ['CON-03', T('Procédures d\'ouverture et de fermeture respectées', 'Opening and closing procedures followed')],
      ['CON-04', T('Dépôts bancaires conformes et complets', 'Bank deposits compliant and complete')]
    ]}
  ];

  const PROCEDURES = [
    { title: T('Ouverture du magasin', 'Store opening'), steps: [
      T('Désactiver l\'alarme et allumer toutes les lumières.', 'Disarm alarm and turn on all lights.'),
      T('Compter le fond de caisse et démarrer le terminal.', 'Count the float and start the terminal.'),
      T('Ouvrir le guide promo en cours sur l\'ordinateur du magasin.', 'Open the current promo guide on the store computer.'),
      T('Faire le tour du plancher : facing, trous, étiquettes.', 'Walk the floor: facing, gaps, tags.'),
      T('Faire le caucus avec l\'équipe : objectif du jour et promos.', 'Hold the huddle: daily target and promos.'),
      T('Ouvrir le rideau à l\'heure d\'ouverture du centre.', 'Open the gate at mall opening time.'),
      T('Remplir le chemin de contrôle (quart d\'ouverture).', 'Complete the control path (opening shift).')
    ]},
    { title: T('Fermeture du magasin', 'Store closing'), steps: [
      T('Annoncer la fermeture 15 minutes avant.', 'Announce closing 15 minutes before.'),
      T('Faire le facing de fermeture et remonter les produits.', 'Do closing facing and recover products.'),
      T('Fermer la caisse, préparer et sécuriser le dépôt.', 'Close the register, prepare and secure the deposit.'),
      T('Ranger ou sécuriser les démos électroniques.', 'Store or secure electronics demos.'),
      T('Remplir le chemin de contrôle (quart de fermeture, section Fermeture activée).', 'Complete the control path (closing shift, Closing section on).'),
      T('Éteindre, verrouiller, fermer le rideau et activer l\'alarme.', 'Lights off, lock up, close gate, set alarm.')
    ]},
    { title: T('Réception de marchandise', 'Receiving merchandise'), steps: [
      T('Vérifier le nombre de cartons avec le bon de livraison.', 'Check carton count against the packing slip.'),
      T('Noter tout carton endommagé avant de signer.', 'Note damaged cartons before signing.'),
      T('Traiter la réception dans le système le jour même.', 'Receive in the system the same day.'),
      T('Étiqueter et placer en priorité les nouveautés et les collaborations.', 'Tag and place new arrivals and collabs first.'),
      T('Aplatir les cartons vides et les sortir au recyclage.', 'Flatten empty cartons and recycle them.')
    ]},
    { title: T('Paiement et PCI DSS', 'Payments & PCI DSS'), steps: [
      T('Inspecter le terminal en début de quart (scellés, câbles, appareil ajouté).', 'Inspect the terminal each shift (seals, cables, added devices).'),
      T('Ne jamais noter un numéro de carte ou un NIP.', 'Never write down a card number or PIN.'),
      T('Signaler tout terminal suspect au directeur immédiatement.', 'Report any suspicious terminal to the manager immediately.')
    ]}
  ];

  const S = {
    fr: {
      subtitle: 'Chemin de contrôle', daily: 'Chemin de contrôle', monthly: 'Visite mensuelle', surprise: 'Visite surprise',
      store: 'Magasin', date: 'Date', time: 'Heure', manager: 'Responsable', shift: 'Quart',
      shifts: { ouverture: 'Ouverture', jour: 'Mi-journée', fermeture: 'Fermeture' },
      choose: 'Choisir…', conform: 'Conforme', nonconform: 'Non conforme', na: 'S.O.', photo: 'Photo', note: 'Note (facultatif)',
      applies: 'Cette section s\'applique à ce quart', actionPlan: 'Plan d\'action', action: 'Action à faire', assignee: 'Assigné à', due: 'Échéance',
      score: 'Score', remaining: 'point(s) restant(s)', allDone: 'Tous les points sont remplis', submit: 'Soumettre le rapport',
      reset: 'Recommencer', resetConfirm: 'Effacer ce rapport en cours ?', yes: 'Oui, effacer', cancel: 'Annuler',
      comments: 'Commentaires généraux', commentsPh: 'Observations, bons coups de l\'équipe, éléments à surveiller…',
      menu: 'Menu', comms: 'Communications', commsNone: 'Aucun message', commsN: 'message(s)', resources: 'Ressources gérant',
      resourcesSub: 'Listes, procédures, contacts', reports: 'Rapports et suivi', reportsN: 'rapport(s)', supervisor: 'Visite superviseur',
      protected: 'Accès protégé', pin: 'NIP superviseur', unlock: 'Déverrouiller', wrongPin: 'NIP incorrect.', lock: 'Verrouiller',
      procedures: 'Procédures', contacts: 'Contacts', links: 'Liens', copy: 'Copier', copied: 'Copié',
      history: 'Historique', actions: 'Actions de suivi', open: 'À faire', inprogress: 'En cours', done: 'Réglé', late: 'En retard',
      start: 'Commencer', markDone: 'Réglé', reopen: 'Rouvrir', noReports: 'Aucun rapport pour l\'instant.', noActions: 'Aucune action.',
      sendReport: 'Envoyer le rapport', share: 'Partager', print: 'Imprimer / PDF', close: 'Fermer', delete: 'Supprimer',
      submitted: 'Rapport soumis', actionRequired: 'Sous le seuil · action requise', aboveThr: 'Conforme au seuil',
      needManager: 'Choisissez le responsable.', needOne: 'Remplissez au moins un point.', synced: 'Synchronisé', pending: 'En attente d\'envoi',
      local: 'Sur cet appareil', syncOn: 'Équipe synchronisée', syncOff: 'Cet appareil seulement', saved: 'Brouillon enregistré',
      avg30: 'Score moyen · 30 j', count30: 'Rapports · 30 j', openActions: 'Actions ouvertes', lateActions: 'En retard', trend: 'Tendance',
      topNC: 'Points le plus souvent non conformes', byEmployee: 'Suivi par employé', all: 'Tous', filterEmp: 'Employé', filterType: 'Type',
      settings: 'Réglages', team: 'Équipe', addEmp: 'Ajouter un employé', name: 'Nom', role: 'Poste', save: 'Enregistrer',
      postMsg: 'Publier un message à l\'équipe', message: 'Message', publish: 'Publier', published: 'Message publié',
      newVisit: 'Nouvelle visite', visitMonthly: 'Démarrer une visite mensuelle', visitSurprise: 'Démarrer une visite surprise',
      supervisorName: 'Superviseur', value: 'Valeur', limit: 'Limite', expandAll: 'Tout ouvrir', collapseAll: 'Tout fermer',
      fillOk: 'Marquer conformes les points non remplis des sections ouvertes', photoAdded: 'Photo ajoutée', photoErr: 'Image illisible. Essayez un JPG ou PNG.',
      offline: 'Hors ligne : le rapport sera envoyé au retour du réseau.', sendFail: 'Envoi impossible pour l\'instant. Nouvel essai automatique.',
      correct: 'Corriger :', reading: 'relevé', resumeDraft: 'Brouillon repris', nc: 'NC', ok: 'OK', itemsOk: 'conformes',
      thr: 'Seuil', by: 'par', createdActions: 'action(s) de suivi créée(s)', view: 'Voir', report: 'Rapport',
      emailHint: 'Le rapport s\'ouvre dans votre application de courriel, adressé à', reportsTitle: 'Rapports et suivi', lang: 'EN',
      sync: 'Synchroniser', syncing: 'Synchronisation…', lastSync: 'Dernière synchro', unassigned: 'Non assigné', footer: 'Chemin de contrôle'
    },
    en: {
      subtitle: 'Control path', daily: 'Control path', monthly: 'Monthly visit', surprise: 'Surprise visit',
      store: 'Store', date: 'Date', time: 'Time', manager: 'Person in charge', shift: 'Shift',
      shifts: { ouverture: 'Opening', jour: 'Mid-day', fermeture: 'Closing' },
      choose: 'Choose…', conform: 'Compliant', nonconform: 'Non-compliant', na: 'N/A', photo: 'Photo', note: 'Note (optional)',
      applies: 'This section applies to this shift', actionPlan: 'Action plan', action: 'Action', assignee: 'Assigned to', due: 'Due',
      score: 'Score', remaining: 'item(s) left', allDone: 'All items completed', submit: 'Submit report',
      reset: 'Start over', resetConfirm: 'Clear this report in progress?', yes: 'Yes, clear', cancel: 'Cancel',
      comments: 'General comments', commentsPh: 'Observations, team wins, things to watch…',
      menu: 'Menu', comms: 'Communications', commsNone: 'No messages', commsN: 'message(s)', resources: 'Manager resources',
      resourcesSub: 'Lists, procedures, contacts', reports: 'Reports & follow-up', reportsN: 'report(s)', supervisor: 'Supervisor visit',
      protected: 'Protected access', pin: 'Supervisor PIN', unlock: 'Unlock', wrongPin: 'Wrong PIN.', lock: 'Lock',
      procedures: 'Procedures', contacts: 'Contacts', links: 'Links', copy: 'Copy', copied: 'Copied',
      history: 'History', actions: 'Follow-up actions', open: 'To do', inprogress: 'In progress', done: 'Done', late: 'Late',
      start: 'Start', markDone: 'Done', reopen: 'Reopen', noReports: 'No reports yet.', noActions: 'No actions.',
      sendReport: 'Send report', share: 'Share', print: 'Print / PDF', close: 'Close', delete: 'Delete',
      submitted: 'Report submitted', actionRequired: 'Below threshold · action required', aboveThr: 'Meets threshold',
      needManager: 'Choose the person in charge.', needOne: 'Fill in at least one item.', synced: 'Synced', pending: 'Waiting to send',
      local: 'On this device', syncOn: 'Team sync on', syncOff: 'This device only', saved: 'Draft saved',
      avg30: 'Average score · 30 d', count30: 'Reports · 30 d', openActions: 'Open actions', lateActions: 'Late', trend: 'Trend',
      topNC: 'Most frequent non-compliances', byEmployee: 'Follow-up by employee', all: 'All', filterEmp: 'Employee', filterType: 'Type',
      settings: 'Settings', team: 'Team', addEmp: 'Add employee', name: 'Name', role: 'Role', save: 'Save',
      postMsg: 'Post a message to the team', message: 'Message', publish: 'Post', published: 'Message posted',
      newVisit: 'New visit', visitMonthly: 'Start a monthly visit', visitSurprise: 'Start a surprise visit',
      supervisorName: 'Supervisor', value: 'Value', limit: 'Limit', expandAll: 'Expand all', collapseAll: 'Collapse all',
      fillOk: 'Mark unanswered items in open sections as compliant', photoAdded: 'Photo added', photoErr: 'Unreadable image. Try a JPG or PNG.',
      offline: 'Offline: the report will be sent when the network is back.', sendFail: 'Could not send yet. Will retry automatically.',
      correct: 'Fix:', reading: 'reading', resumeDraft: 'Draft resumed', nc: 'NC', ok: 'OK', itemsOk: 'compliant',
      thr: 'Threshold', by: 'by', createdActions: 'follow-up action(s) created', view: 'View', report: 'Report',
      emailHint: 'The report opens in your mail app, addressed to', reportsTitle: 'Reports & follow-up', lang: 'FR',
      sync: 'Sync', syncing: 'Syncing…', lastSync: 'Last sync', unassigned: 'Unassigned', footer: 'Control path'
    }
  };

  const norm = secs => secs.map(s => ({ ...s, items: s.items.map(([id, text, opt]) => ({ id, text, ...(opt || {}) })) }));
  window.APP_DATA = { templates: { daily: norm(DAILY), monthly: norm(MONTHLY), surprise: norm(DAILY) }, procedures: PROCEDURES, strings: S };
})();
