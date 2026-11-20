// Catalogue de départ : familles de notes, types, étiquettes, cercles, facettes.
// Tout est modifiable ensuite (afficher / masquer, renommer, ajouter) depuis les Réglages.

export const FAMILLES = [
  { id: 'etat', nom: 'États', couleur: '#c2416b', aide: 'Ce que tu ressens, de 0 à 10' },
  { id: 'envie', nom: 'Envies', couleur: '#e0794f', aide: "L'envie, cédée ou traversée" },
  { id: 'coping', nom: 'Coping', couleur: '#8a6fc4', aide: 'Ce que tu fais pour tenir le coup' },
  { id: 'activite', nom: 'Activités', couleur: '#3f9d93', aide: 'Ce que tu fais de ta journée' },
  { id: 'declencheur', nom: 'Déclencheurs', couleur: '#7f8ea3', aide: 'Ce qui a lancé quelque chose' },
  { id: 'aide', nom: 'Actions aidantes', couleur: '#4f9d5d', aide: 'Ce qui casse la chaîne' },
  { id: 'sommeil', nom: 'Sommeil', couleur: '#4f6fae', aide: 'Endormissement, nuit' },
];

export const famille = (id) => FAMILLES.find((f) => f.id === id);

// Comportement de saisie par famille :
// intensite : on demande 0–10 ; plage : on propose « depuis… / je commence » ; issue : cédé / traversée ;
// aide : « a aidé ? » ; activite : nom libre, plaisir, maîtrise, facettes.
export const SAISIE = {
  etat: { intensite: true },
  envie: { intensite: true, issue: true },
  coping: { plage: true, quantite: true },
  activite: { plage: true, activite: true },
  declencheur: {},
  aide: { aide: true },
  sommeil: { plage: true, intensite: true },
};

const ECHELLE = { min: 0, max: 10, bas: 'à peine', haut: 'très fort' };

const t = (famille, id, nom, extra = {}) => ({ id, famille, nom, visible: true, echelle: SAISIE[famille].intensite ? { ...ECHELLE } : null, ...extra });

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

    t('sommeil', 'endormissement', 'Endormissement', { echelle: { min: 0, max: 10, bas: 'apaisé', haut: 'très agité' } }),
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

/** Une journée de vie va de 5 h à 5 h : une note à 1 h du matin appartient à la veille. */
export const DEBUT_JOURNEE = 5;
