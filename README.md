# Logger

Calendriers de suivi : fatigue, stress, oublis, phrases dites… Un calendrier par chose à suivre,
une saisie à la journée ou à l'heure, une échelle et des étiquettes facultatives, et des stats
qui ne montrent que des faits comptés (jours, heures, rythme, croisements entre calendriers).

Web app installable (PWA), sans serveur : les données restent dans le navigateur.
Export complet en un fichier (`AAAAMMJJ - Logger - Export complet.txt`, JSON lisible) et réimport.

En ligne : https://nnd202.github.io/logger/

Le dépôt est public : il ne contient que le code et un exemple inventé.

- `node tools/check.mjs` : liste CORE du service worker et tests du moteur d'analyse.
