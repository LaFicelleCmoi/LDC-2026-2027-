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
| `i18n.js`        | Traduction FR/EN partagée (clé localStorage `ldc_lang`, attributs `data-i18n`). |
| `espn.js`        | Couche d'accès ESPN (fetch robuste, classement, bracket). |
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

1. `git push` sur `main`.
2. Projet Vercel : Framework **Other**, build command **vide**, output **vide**.
3. `vercel.json` réécrit `/` → `/dashboard.html`.

## Robustesse

- Timeout sur chaque `fetch` (`AbortSignal.timeout` + fallback `AbortController`).
- En cas d'échec/timeout : le **dernier affichage valide est conservé** (jamais de page vide).
- Events ESPN malformés filtrés défensivement.
- Caches courts (scoreboard ~15 s, summary ~20 s) ; polling ~15-30 s quand l'onglet est visible.
- Timers de rotation protégés par `try/catch`.

## Cache-busting

Les assets sont versionnés via `?v=N` (`i18n.js?v=1`, `espn.js?v=1`, `styles.css?v=1`).
Après une modif, incrémente `N` dans les balises `<script>` / `<link>`.
