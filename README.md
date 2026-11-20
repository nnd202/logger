# Logger

Journal de santé mentale à un seul fil : états, envies, coping, activités, déclencheurs, actions
aidantes, sommeil. On note en deux touchers ; la journée se lit en frise verticale (un calque par type),
les notes rapprochées forment des épisodes, que l'on peut figer en blocs.

Web app installable (PWA), sans serveur : les données restent dans le navigateur. Export en un fichier
`.txt` chiffré avec le code à 6 chiffres (AES-GCM, clé PBKDF2), réimport avec copie de secours.

En ligne : https://nnd202.github.io/logger/

Le dépôt est public : il ne contient que le code et un exemple inventé.

- `node tools/check.mjs` : liste CORE du service worker, épisodes, blocs, jours renseignés, export chiffré, import.
