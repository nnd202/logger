// Catalogue de départ : familles de notes, types, étiquettes, cercles, facettes.
// Tout est modifiable ensuite (afficher / masquer, renommer, ajouter) depuis les Réglages.

export const FAMILLES = [
  { id: 'etat', un: 'État', nom: 'États', couleur: '#c2416b', aide: 'Ce que tu ressens, de 0 à 10' },
  { id: 'corps', un: 'Corps', nom: 'Corps', couleur: '#b07a3c', aide: 'Ce que ressent ton corps, de 0 à 10' },
  { id: 'envie', un: 'Envie', nom: 'Envies', couleur: '#e0794f', aide: "L'envie, cédée ou traversée" },
  { id: 'coping', un: 'Coping', nom: 'Coping', couleur: '#8a6fc4', aide: 'Ce que tu fais pour tenir le coup' },
  { id: 'activite', un: 'Activité', nom: 'Activités', couleur: '#3f9d93', aide: 'Ce que tu fais de ta journée' },
  { id: 'declencheur', un: 'Déclencheur', nom: 'Déclencheurs', couleur: '#7f8ea3', aide: 'Ce qui a lancé quelque chose' },
  { id: 'aide', un: 'Action aidante', nom: 'Actions aidantes', couleur: '#4f9d5d', aide: 'Ce qui casse la chaîne' },
  { id: 'sommeil', un: 'Sommeil', nom: 'Sommeil', couleur: '#4f6fae', aide: 'Endormissement, réveils, sieste' },
];

export const famille = (id) => FAMILLES.find((f) => f.id === id);

// Comportement de saisie par famille :
// intensite : 0–10 ; plage : on propose « depuis… / je commence » ; l'issue d'une envie (cédée / traversée) se déduit ;
// aide : « a aidé ? » ; activite : nom libre, plaisir, maîtrise, facettes.
export const SAISIE = {
  etat: { intensite: true },
  corps: { intensite: true },
  envie: { intensite: true },
  coping: { plage: true, quantite: true, intensite: true },
  activite: { plage: true, activite: true },
  declencheur: {},
  aide: { aide: true },
  sommeil: { plage: true, intensite: true },
};

const ECHELLE = { min: 0, max: 10, bas: 'à peine', haut: 'très fort' };
/** Coping : à quel point je me suis lâché. */
export const ECHELLE_COPING = { min: 0, max: 10, bas: 'sans entrain', haut: 'déchaînement' };

/** Icône (emoji) de chaque type de départ ; modifiable dans les Réglages. */
export const ICONES = {
  agitation: '🌀', maletre: '🌧️', stress: '😰', tristesse: '😢', irritabilite: '😤', fatigue: '🥱', somnolence: '😪', energie: '⚡', calme: '😌',
  nausees: '🤢', tete: '🤕', ventre: '😖', courbatures: '🦵', blessure: '🩹', rhume: '🤧', douleur: '💢',
  'e-manger': '🍔', 'e-cigarette': '🚬', 'e-alcool': '🍷', 'e-porno': '🍑', 'e-jeux': '🎮', 'e-ecrans': '📱', 'e-achats': '🛍️', 'e-dormir': '😴', 'e-reverie': '💭',
  'c-manger': '🍔', 'c-cigarette': '🚬', 'c-alcool': '🍷', 'c-porno': '🍑', 'c-jeux': '🎮', 'c-ecrans': '📱', 'c-achats': '🛍️', 'c-dormir': '😴', 'c-reverie': '💭',
  travail: '💼', sport: '🏋️', sortie: '👥', taches: '🧺', loisir: '🎨', repos: '🛋️',
  declencheur: '💥',
  respiration: '🌬️', marche: '🚶', 'a-sport': '🤸', appel: '📞', douche: '🚿', coucher: '🛏️', ecrire: '✍️', musique: '🎧',
  endormissement: '🌙', reveil: '👁️',
};

/** Icône par défaut d'un type ajouté, selon sa famille. */
export const ICONE_FAMILLE = { etat: '🙂', corps: '🩺', envie: '✨', coping: '🔁', activite: '📌', declencheur: '💥', aide: '🌱', sommeil: '🌙' };

/** Suggestions proposées au choix d'une icône ; n'importe quel emoji du clavier marche aussi. */
export const SUGGESTIONS = [
  ['Humeur', '😀 🙂 😐 😕 🙁 😢 😭 😰 😨 😱 😤 😠 🤯 😵‍💫 🌀 🌧️ ⛈️ ☁️ 🌤️ 😌 🫠 🥲 😶‍🌫️ 🤪 🥺 😬'],
  ['Corps', '🤢 🤮 🤕 🤒 🤧 😷 🩹 🦵 🦶 💪 🫀 🫁 🧠 🦷 👁️ 💢 🔥 ❄️ 🩸 💊'],
  ['Envies, coping', '🍔 🍕 🍫 🍬 🍩 🍟 🍷 🍺 🥃 ☕ 🚬 🍑 🔞 🎮 📱 💻 📺 🛍️ 💸 🎰 😴 💭'],
  ['Activités', '💼 📚 ✍️ 🎨 🎸 🎧 🏋️ 🚴 🏃 🧘 🚶 👥 👨‍👩‍👧 🧺 🧹 🍳 🚗 🚇 🛋️ 🌳 💻'],
  ['Aides', '🌬️ 🚿 🛁 📞 💬 🤗 🌱 ☀️ 🎵 🐾 🫖 📝'],
  ['Sommeil', '🌙 🛏️ 😴 💤 👁️ ⏰ 🌗'],
];

const t = (famille, id, nom, extra = {}) => ({ id, famille, nom, visible: true, icone: ICONES[id] || ICONE_FAMILLE[famille], echelle: famille === 'coping' ? { ...ECHELLE_COPING } : SAISIE[famille].intensite ? { ...ECHELLE } : null, ...extra });

export function typesDeDepart() {
  return [
    t('etat', 'agitation', 'Agitation mentale'),
    t('etat', 'maletre', 'Mal-être'),
    t('etat', 'stress', 'Stress / anxiété'),
    t('etat', 'tristesse', 'Tristesse'),
    t('etat', 'irritabilite', 'Irritabilité'),
    t('etat', 'fatigue', 'Fatigue'),
    t('etat', 'somnolence', 'Somnolence'),
    t('etat', 'energie', 'Énergie', { echelle: { min: 0, max: 10, bas: 'à plat', haut: 'pleine forme' } }),
    t('etat', 'calme', 'Calme', { echelle: { min: 0, max: 10, bas: 'à peine', haut: 'très apaisé' } }),

    t('corps', 'nausees', 'Nausées'),
    t('corps', 'tete', 'Mal de tête'),
    t('corps', 'ventre', 'Mal de ventre'),
    t('corps', 'courbatures', 'Courbatures intenses'),
    t('corps', 'blessure', 'Blessure'),
    t('corps', 'rhume', 'Rhume'),
    t('corps', 'douleur', 'Autre douleur'),

    t('envie', 'e-manger', 'Manger'),
    t('envie', 'e-cigarette', 'Cigarette'),
    t('envie', 'e-alcool', 'Alcool'),
    t('envie', 'e-porno', 'Porno / sexe'),
    t('envie', 'e-jeux', 'Jeux vidéo'),
    t('envie', 'e-ecrans', 'Scroll / écrans'),
    t('envie', 'e-achats', 'Achats'),
    t('envie', 'e-dormir', 'Dormir pour fuir'),
    t('envie', 'e-reverie', 'Partir dans ma tête'),

    t('coping', 'c-manger', 'Manger'),
    t('coping', 'c-cigarette', 'Cigarette'),
    t('coping', 'c-alcool', 'Alcool'),
    t('coping', 'c-porno', 'Porno / sexe'),
    t('coping', 'c-jeux', 'Jeux vidéo'),
    t('coping', 'c-ecrans', 'Scroll / écrans'),
    t('coping', 'c-achats', 'Achats'),
    t('coping', 'c-dormir', 'Dormir en journée', { motifs: ['pour récupérer', 'pour fuir', 'je ne sais pas'] }),
    t('coping', 'c-reverie', 'Rêverie'),

    t('activite', 'travail', 'Travail'),
    t('activite', 'sport', 'Sport'),
    t('activite', 'sortie', 'Sortie / voir du monde'),
    t('activite', 'taches', 'Tâches, courses'),
    t('activite', 'loisir', 'Loisir, projet perso'),
    t('activite', 'repos', 'Repos'),

    t('declencheur', 'declencheur', 'Déclencheur'),

    t('aide', 'respiration', 'Respiration'),
    t('aide', 'marche', 'Marche'),
    t('aide', 'a-sport', 'Bouger, sport'),
    t('aide', 'appel', "Appeler quelqu'un"),
    t('aide', 'douche', 'Douche'),
    t('aide', 'coucher', 'Se coucher'),
    t('aide', 'ecrire', 'Écrire'),
    t('aide', 'musique', 'Musique'),

    t('sommeil', 'endormissement', 'Endormissement', { echelle: { min: 0, max: 10, bas: 'apaisé', haut: 'très agité' }, endormissement: true }),
    t('sommeil', 'reveil', 'Réveil dans la nuit', { echelle: null }),
  ];
}

export function etiquettesDeDepart() {
  return ['travail', 'télétravail', 'bouchons', 'conflit', 'message', 'une pensée', 'seul', 'à la maison', 'dehors', 'écran', 'mal dormi', 'faim', 'musique', 'ennui']
    .map((nom, i) => ({ id: `t${i + 1}`, nom, archive: false }));
}

export const CERCLES = [
  { id: 'seul', nom: 'Seul' },
  { id: 'couple', nom: 'Couple' },
  { id: 'famille', nom: 'Famille' },
  { id: 'amis', nom: 'Amis' },
  { id: 'collegues', nom: 'Collègues' },
  { id: 'autres', nom: 'Autres' },
];

export const FACETTES = [
  { id: 'choisie', nom: 'Choisie' },
  { id: 'subie', nom: 'Subie' },
  { id: 'ecran', nom: 'Écran' },
  { id: 'physique', nom: 'Physique' },
  { id: 'mental', nom: 'Mental' },
  { id: 'creatif', nom: 'Créatif' },
  { id: 'dehors', nom: 'Dehors' },
];

export const MOMENTS = [
  { id: 'nuit', nom: 'La nuit', heure: '03:00' },
  { id: 'matin', nom: 'Le matin', heure: '09:00' },
  { id: 'apresmidi', nom: "L'après-midi", heure: '15:00' },
  { id: 'soir', nom: 'Le soir', heure: '20:00' },
];

export const AIDE = [
  { id: 'oui', nom: 'A aidé' },
  { id: 'unpeu', nom: 'Un peu' },
  { id: 'non', nom: "N'a pas aidé" },
];

export const ISSUES = [
  { id: 'traversee', nom: 'Traversée' },
  { id: 'cede', nom: 'Cédé' },
];

/** Une journée va de 0 h à 24 h (choix du 21 novembre). Une plage qui passe minuit (endormissement)
 * s'affiche sur les deux jours. */
export const DEBUT_JOURNEE = 0;

/** Temps estimé pour s'endormir (journal de sommeil de consensus) ; la zone affichée fait au moins 30 min. */
export const LATENCES = [
  { min: 10, nom: 'Moins de 15 min' },
  { min: 25, nom: '15 à 30 min' },
  { min: 45, nom: '30 min à 1 h' },
  { min: 90, nom: "Plus d'1 h" },
];
export const ZONE_MIN = 30;
