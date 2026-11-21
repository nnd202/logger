// Questionnaires validés, versions françaises officielles, libres d'usage :
// WHO-5 (Centre collaborateur OMS, Hillerød), PHQ-9 et GAD-7 (Pfizer, reproduction libre, phqscreeners.com),
// AUDIT-C (trois premières questions de l'AUDIT de l'OMS ; seuils de la Société française d'alcoologie).
// Les énoncés gardent le vouvoiement des versions validées. Les résultats donnent un repère, jamais un diagnostic.

const FREQ_PHQ = [
  { v: 0, t: 'Jamais' },
  { v: 1, t: 'Plusieurs jours' },
  { v: 2, t: 'Plus de la moitié du temps' },
  { v: 3, t: 'Presque tous les jours' },
];

const FREQ_WHO = [
  { v: 5, t: 'Tout le temps' },
  { v: 4, t: 'La plupart du temps' },
  { v: 3, t: 'Plus de la moitié du temps' },
  { v: 2, t: 'Moins de la moitié du temps' },
  { v: 1, t: 'De temps en temps' },
  { v: 0, t: 'Jamais' },
];

const somme = (r) => r.reduce((a, b) => a + (b ?? 0), 0);

export const QUESTIONNAIRES = [
  {
    id: 'who5',
    nom: 'WHO-5',
    titre: 'Bien-être',
    mesure: 'Ton bien-être ces deux dernières semaines, en 5 questions positives.',
    periode: 'Au cours des deux dernières semaines',
    duree: '1 min',
    rythme: 14,
    consigne: 'Veuillez indiquer, pour chacune des cinq affirmations, laquelle se rapproche le plus de ce que vous avez ressenti au cours des deux dernières semaines.',
    items: [
      'Je me suis senti(e) bien et de bonne humeur',
      'Je me suis senti(e) calme et tranquille',
      "Je me suis senti(e) plein(e) d'énergie et vigoureux(se)",
      'Je me suis réveillé(e) en me sentant frais(che) et dispos(e)',
      'Ma vie quotidienne a été remplie de choses intéressantes',
    ],
    reponses: () => FREQ_WHO,
    score: (r) => somme(r) * 4,
    max: 100,
    unite: '/ 100',
    sens: 'haut', // plus haut = mieux
    bandes: [
      { max: 28, t: 'Bien-être très bas', d: "Un score aussi bas mérite d'en parler à un médecin ou à un professionnel de santé mentale.", niveau: 3 },
      { max: 50, t: 'Bien-être bas', d: "En dessous de 50, il est conseillé de faire le point, par exemple avec le PHQ-9, et d'en parler si cela dure.", niveau: 2 },
      { max: 100, t: 'Bien-être correct', d: 'Au-dessus de 50 : pas de signal particulier.', niveau: 0 },
    ],
  },
  {
    id: 'phq9',
    nom: 'PHQ-9',
    titre: 'Humeur',
    mesure: "L'intensité des signes dépressifs ces deux dernières semaines.",
    periode: 'Au cours des deux dernières semaines',
    duree: '2 min',
    rythme: 14,
    consigne: 'Au cours des deux dernières semaines, selon quelle fréquence avez-vous été gêné(e) par les problèmes suivants ?',
    items: [
      "Peu d'intérêt ou de plaisir à faire les choses",
      'Être triste, déprimé(e) ou désespéré(e)',
      "Difficultés à s'endormir ou à rester endormi(e), ou dormir trop",
      "Se sentir fatigué(e) ou manquer d'énergie",
      "Avoir peu d'appétit ou manger trop",
      "Avoir une mauvaise opinion de soi-même, ou le sentiment d'être nul(le), ou d'avoir déçu sa famille ou s'être déçu(e) soi-même",
      'Avoir du mal à se concentrer, par exemple pour lire le journal ou regarder la télévision',
      "Bouger ou parler si lentement que les autres auraient pu le remarquer. Ou au contraire, être si agité(e) que vous avez eu du mal à tenir en place par rapport à d'habitude",
      "Penser qu'il vaudrait mieux mourir, ou envisager de vous faire du mal d'une manière ou d'une autre",
    ],
    sensible: 8, // index de la question qui déclenche le message d'aide dès qu'elle n'est pas « Jamais »
    reponses: () => FREQ_PHQ,
    score: somme,
    max: 27,
    unite: '/ 27',
    sens: 'bas',
    bandes: [
      { max: 4, t: 'Minime', d: 'Pas de signal particulier.', niveau: 0 },
      { max: 9, t: 'Léger', d: "Des signes légers : utile de suivre l'évolution.", niveau: 1 },
      { max: 14, t: 'Modéré', d: "Des signes modérés : c'est un bon moment pour en parler à un médecin.", niveau: 2 },
      { max: 19, t: 'Modérément sévère', d: 'Des signes marqués : en parler à un médecin est conseillé.', niveau: 3 },
      { max: 27, t: 'Sévère', d: 'Des signes importants : il est conseillé de consulter rapidement un médecin.', niveau: 3 },
    ],
  },
  {
    id: 'gad7',
    nom: 'GAD-7',
    titre: 'Anxiété',
    mesure: "L'intensité de l'anxiété ces deux dernières semaines.",
    periode: 'Au cours des 14 derniers jours',
    duree: '1 min',
    rythme: 14,
    consigne: 'Au cours des 14 derniers jours, à quelle fréquence avez-vous été dérangé(e) par les problèmes suivants ?',
    items: [
      "Un sentiment de nervosité, d'anxiété ou de tension",
      "Une incapacité à arrêter de s'inquiéter ou à contrôler ses inquiétudes",
      'Une inquiétude excessive à propos de différentes choses',
      'Des difficultés à se détendre',
      "Une agitation telle qu'il est difficile de rester tranquille",
      'Une tendance à être facilement contrarié(e) ou irritable',
      'Un sentiment de peur, comme si quelque chose de terrible risquait de se produire',
    ],
    reponses: () => FREQ_PHQ,
    score: somme,
    max: 21,
    unite: '/ 21',
    sens: 'bas',
    bandes: [
      { max: 4, t: 'Minime', d: 'Pas de signal particulier.', niveau: 0 },
      { max: 9, t: 'Léger', d: "Une anxiété légère : utile de suivre l'évolution.", niveau: 1 },
      { max: 14, t: 'Modéré', d: "Une anxiété modérée : à partir de 10, il est conseillé d'en parler à un médecin.", niveau: 2 },
      { max: 21, t: 'Sévère', d: 'Une anxiété importante : en parler à un médecin est conseillé.', niveau: 3 },
    ],
  },
  {
    id: 'auditc',
    nom: 'AUDIT-C',
    titre: 'Alcool',
    mesure: "Ta consommation d'alcool sur l'année écoulée, en 3 questions.",
    periode: "Sur l'année écoulée",
    duree: '1 min',
    rythme: 90,
    consigne: "Ces questions portent sur l'année écoulée. Un verre standard = 10 g d'alcool : un verre de vin (10 cl), un demi de bière (25 cl), un verre d'alcool fort (3 cl).",
    items: [
      "Combien de fois vous arrive-t-il de consommer de l'alcool ?",
      "Combien de verres standard buvez-vous au cours d'une journée ordinaire où tu bois de l'alcool ?",
      "Au cours d'une même occasion, combien de fois vous arrive-t-il de boire six verres standard ou plus ?",
    ],
    reponses: (i) => [
      [
        { v: 0, t: 'Jamais' }, { v: 1, t: 'Une fois par mois ou moins' }, { v: 2, t: '2 à 4 fois par mois' },
        { v: 3, t: '2 à 3 fois par semaine' }, { v: 4, t: '4 fois ou plus par semaine' },
      ],
      [
        { v: 0, t: '1 ou 2' }, { v: 1, t: '3 ou 4' }, { v: 2, t: '5 ou 6' }, { v: 3, t: '7 à 9' }, { v: 4, t: '10 ou plus' },
      ],
      [
        { v: 0, t: 'Jamais' }, { v: 1, t: "Moins d'une fois par mois" }, { v: 2, t: 'Une fois par mois' },
        { v: 3, t: 'Une fois par semaine' }, { v: 4, t: 'Tous les jours ou presque' },
      ],
    ][i],
    score: somme,
    max: 12,
    unite: '/ 12',
    sens: 'bas',
    bandes: [
      { max: 2, t: 'Pas de signal', d: 'En dessous des seuils de consommation à risque.', niveau: 0 },
      { max: 3, t: 'À surveiller', d: "Un score de 3 évoque un mésusage chez une femme ; le seuil est de 4 chez un homme.", niveau: 1 },
      { max: 9, t: 'Mésusage probable', d: "À partir de 4 (3 chez une femme), la consommation est à risque : utile d'en parler à un médecin.", niveau: 2 },
      { max: 12, t: 'Dépendance probable', d: 'À partir de 10, une dépendance est probable : en parler à un médecin est conseillé.', niveau: 3 },
    ],
  },
];

export const questionnaire = (id) => QUESTIONNAIRES.find((q) => q.id === id);

export function bande(q, score) {
  return q.bandes.find((b) => score <= b.max) || q.bandes[q.bandes.length - 1];
}

/** Aide en cas de détresse : affichée dès qu'une réponse sensible n'est pas « Jamais », et dans les Réglages. */
export const AIDE_URGENCE = {
  numero: '3114',
  texte: 'Numéro national de prévention du suicide : gratuit, 24 h/24, 7 j/7, pour toi ou pour un proche.',
  danger: 'En cas de danger immédiat : 15 (SAMU) ou 112.',
};
