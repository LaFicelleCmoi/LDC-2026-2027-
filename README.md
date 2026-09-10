# Tracker & Overlay — Ligue des Champions (UEFA Champions League)

Tracker + simulateur **live** de la Ligue des Champions, avec **overlay OBS** pour le stream.
100 % **vanilla** (HTML / CSS / JS), **aucun build**, **aucun npm**. Déploiement statique sur Vercel.

> ⚠️ Projet de **fan, non officiel**. Non affilié à l'UEFA. Données issues de l'API **publique non
> officielle d'ESPN**, à titre indicatif. Voir `legal.html`.

## Pages

| Fichier          | Rôle |
|------------------|------|
| `dashboard.html` | Accueil : matchs du jour (live/à venir/terminés) + explorateur de club (parcours, buteurs, prochains adversaires). |
| `tracker.html`   | Classement de la phase de ligue (36 clubs) + phase finale (cartes & arbre) + widget live. |
| `overlay.html`   | **Overlay OBS** autonome, fond transparent. |
| `legal.html`     | Mentions légales. |
| `calendrier.html`| Calendrier des rencontres + vue « Tirage LDC » (bascule en haut de page). |
| `i18n.js`        | Traduction FR/EN partagée (clé localStorage `ldc_lang`, attributs `data-i18n`). |
| `espn.js`        | Couche d'accès ESPN (fetch robuste, classement, bracket) + les 36 qualifiés 2026-27. |
| `draw2026.js`    | Résultat officiel du tirage UEFA du 27/08/2026 : les 8 adversaires (4 ⌂ / 4 ✈) de chacun des 36 clubs, indexés par identifiant ESPN. Repli quand ESPN n'a pas encore publié le calendrier. |
| `standings-engine.js` | **Moteur de classement pur** (sans DOM ni réseau) : article 18.01 du règlement UEFA, testé. |
| `coefficients2026.js` | Coefficients clubs UEFA 2026/27 (dernier critère de départage), source et règle documentées. |
| `simulate.js`    | Simulateur « What-If » : injecte des scores fictifs et reclasse via le moteur. |
| `schedule.js`    | Calendrier, logique pure : `getNextMatchDate()` trouve la prochaine date qui a des matchs (onglet « À venir »). |
| `tests/`         | Tests unitaires (`node --test tests/*.test.js`), dont le classement officiel 2024-25 reproduit. |
| `styles.css`     | Thème sombre partagé. |

## Source de données

API publique ESPN — **le seul paramètre qui change la compétition est le slug**, isolé dans une constante :

```js
var LEAGUE_SLUG = 'uefa.champions';   // dans espn.js ET overlay.html
```

- Scoreboard : `https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard`
- Plage : `.../scoreboard?dates=YYYYMMDD-YYYYMMDD&limit=500`
- Détail (buteurs, cartons…) : `.../summary?event={id}` → champ `keyEvents`

## Overlay OBS — paramètres d'URL

Ajoute une **source navigateur** dans OBS pointant vers `…/overlay.html` (coche *Page transparente* — c'est déjà le cas).

| Param        | Exemple                | Effet |
|--------------|------------------------|-------|
| `team`       | `?team=PSG`            | Épingle un club (nom anglais **ou** abréviation 3 lettres : PSG, RMA, BAR…). |
| `pos`        | `?pos=top-right`       | Coin : `top-left`, `top-right`, `bottom-left`, `bottom-right` (défaut `bottom-left`). |
| `scale`      | `?scale=1.3`           | Échelle du scorebug. |
| `hideEmpty`  | `?hideEmpty=1`         | Masque totalement l'overlay s'il n'y a rien à afficher. |
| `lang`       | `?lang=en`             | Force la langue. |

Exemple : `overlay.html?team=PSG&pos=top-right&scale=1.2&hideEmpty=1`

L'overlay gère : flash/bump sur but, liste de tous les événements (buts, CF, PEN, CSC, PEN✗, cartons),
rappel cartons par équipe, temps additionnel (`90'+3'`) mis en valeur, `⏸ Interrompu`,
`💧 Pause fraîcheur` (drinks break), rotation entre matchs live (~10 s).

## Saison

La saison est détectée automatiquement (août → juillet). Pour forcer une saison précise (année de début) :
`?season=2026` sur n'importe quelle page.

## Déploiement Vercel

Le dépôt est déjà relié au projet Vercel `ldc-2026-2027` et au domaine
`https://ldc-2026-2027.vercel.app`.

1. Valider les changements dans Git, puis envoyer la branche `main` sur GitHub.
2. Vercel crée automatiquement un déploiement de production depuis `main`.
3. `vercel.json` impose le preset **Other**, sans installation ni build, et réécrit `/` vers `/dashboard.html`.
4. Contrôler le statut **Ready** dans Vercel, puis tester le domaine de production.

> ⚠️ **Ne pas déployer depuis le poste local** (`vercel --prod`). Le CLI envoie l'arbre de
> travail tel quel — fichiers non suivis et modifications non validées comprises — et la
> production devient introuvable dans l'historique Git. Le seul chemin supporté est
> GitHub → Vercel.

## Classement de la phase de ligue

Le tri applique l'**article 18.01** du règlement de l'UEFA Champions League 2026/27, sans simplification.
Trois couches séparées :

1. **Données** — `espn.js` : matchs (API ESPN), cartons (keyEvents des résumés), date de synchronisation.
2. **Tri** — `standings-engine.js` : fonction pure `rankLeaguePhase(matches, options)`.
3. **Affichage** — `dashboard.html` / `tracker.html` : découpage en zones 1-8 / 9-24 / 25-36.

| Phase | Critères, dans l'ordre |
|---|---|
| **En cours** | points → différence de buts → buts marqués → buts à l'extérieur → victoires → victoires à l'extérieur ; puis **rang partagé, ordre alphabétique** |
| **Terminée** | les mêmes, puis points des adversaires → différence de buts des adversaires → buts des adversaires → fair-play le plus bas (rouge ou 2 jaunes = 3, jaune = 1) → coefficient club (annexes D.4 et D.8) |

- **Pas de confrontation directe** : l'article 18.01 ne la prévoit pas pour la phase de ligue.
  Elle n'existe qu'en option explicitement hors règlement (`{ headToHead: true }`), désactivée.
- **On ne saute jamais un critère** : si une donnée manque (cartons non chargés, coefficient inconnu),
  les équipes concernées sont marquées `unresolved` au lieu d'être classées par le critère suivant.
- **Trophées** : l'API ESPN n'en fournit pas. Ils viennent de `UCL_PALMARES` (`espn.js`), vérifié contre
  les 71 finales 1956-2026, et sont recherchés **par identifiant ESPN**.

Vérification de référence : sur les 144 matchs de 2024-25, le moteur reproduit les 36 positions du
classement final officiel, dont Real Madrid 11e devant le Bayern aux victoires à l'extérieur.

## Tests

Aucune dépendance, Node 18 ou plus :

```bash
node --test tests/*.test.js
```

## Robustesse

- Timeout sur chaque `fetch` (`AbortSignal.timeout` + fallback `AbortController`).
- En cas d'échec/timeout : le **dernier affichage valide est conservé** (jamais de page vide).
- Events ESPN malformés filtrés défensivement.
- Caches courts (scoreboard ~15 s, summary ~20 s) ; polling ~15-30 s quand l'onglet est visible.
- Timers de rotation protégés par `try/catch`.

## Cache-busting

Les assets sont versionnés via `?v=N` (`i18n.js?v=1`, `espn.js?v=1`, `styles.css?v=1`).
Après une modif, incrémente `N` dans les balises `<script>` / `<link>`.
