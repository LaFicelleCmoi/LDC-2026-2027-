/* =========================================================================
   coefficients2026.js — Coefficients clubs UEFA pour la saison 2026/27
   -------------------------------------------------------------------------
   Sert UNIQUEMENT au dernier critère de départage de l'article 18.01
   (10. « coefficient club le plus élevé ») et à l'annexe D.8.

   Règle appliquée (annexe D.4, 2026/27, citée) : « A club's five-season
   coefficient is the cumulative total of its five season coefficients from the
   reference period stipulated in Annex D.2, or 20% of its association's
   five-season association coefficient, whichever is higher. »
   Période de référence pour 2026/27 : saisons 2021/22 à 2025/26 incluses.

   Source des valeurs : kassiesa.net, « UEFA 5-year Club Ranking 2026 »
     https://kassiesa.net/uefa/data/method5/trank2026.html
   relevé le 2026-09-10. Colonnes « Total » (somme des 5 saisons) et
   « Country Part » (20 % du coefficient de l'association).

   ⚠ Source NON officielle. L'API de uefa.com (comp.uefa.com/v2/coefficients)
   a refusé la requête (HTTP 400) : ces valeurs n'ont PAS pu être recoupées
   avec la publication officielle. À revérifier sur
   https://www.uefa.com/nationalassociations/uefarankings/club/ si le critère
   10 venait un jour à être réellement atteint.

   Cas particuliers :
   - RC Lens, Viking (Stavanger) et Como : la somme de leurs saisons est
     inférieure à 20 % du coefficient de leur association, c'est donc cette
     part qui s'applique.
   - Como est absent de la table (aucun point européen sur la période) :
     somme = 0, coefficient = part de l'association italienne.
   - Viking figure dans la table sous le nom « Viking Stavanger » ; ne pas le
     confondre avec Víkingur Reykjavík, qui y figure aussi.
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LDCCoefficients2026 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return {
    season: '2026/27',
    retrieved: '2026-09-10',
    source: 'https://kassiesa.net/uefa/data/method5/trank2026.html',
    official: false,
    seasons: ["2021/22","2022/23","2023/24","2024/25","2025/26"],
    clubs: {
    "83": {"name":"FC Barcelona","country":"Esp","coefficient":113.25,"sum":113.25,"countryPart":19.409,"basis":"sum","seasons":{"2021/22":15,"2022/23":9,"2023/24":23,"2024/25":36.25,"2025/26":30}},
    "86": {"name":"Real Madrid","country":"Esp","coefficient":144.5,"sum":144.5,"countryPart":19.409,"basis":"sum","seasons":{"2021/22":30,"2022/23":29,"2023/24":34,"2024/25":24.5,"2025/26":27}},
    "102": {"name":"Villarreal","country":"Esp","coefficient":59,"sum":59,"countryPart":19.409,"basis":"sum","seasons":{"2021/22":24,"2022/23":12,"2023/24":16,"2024/25":null,"2025/26":7}},
    "104": {"name":"AS Roma","country":"Ita","coefficient":97.75,"sum":97.75,"countryPart":19.989,"basis":"sum","seasons":{"2021/22":23,"2022/23":22,"2023/24":21,"2024/25":14.5,"2025/26":17.25}},
    "110": {"name":"Internazionale","country":"Ita","coefficient":127,"sum":127,"countryPart":19.989,"basis":"sum","seasons":{"2021/22":18,"2022/23":29,"2023/24":20,"2024/25":40.25,"2025/26":19.75}},
    "114": {"name":"Napoli","country":"Ita","coefficient":63,"sum":63,"countryPart":19.989,"basis":"sum","seasons":{"2021/22":9,"2022/23":25,"2023/24":17,"2024/25":null,"2025/26":12}},
    "124": {"name":"Borussia Dortmund","country":"Ger","coefficient":100.75,"sum":100.75,"countryPart":18.58,"basis":"sum","seasons":{"2021/22":10,"2022/23":18,"2023/24":29,"2024/25":27.75,"2025/26":16}},
    "132": {"name":"Bayern München","country":"Ger","coefficient":147.5,"sum":147.5,"countryPart":18.58,"basis":"sum","seasons":{"2021/22":26,"2022/23":27,"2023/24":28,"2024/25":27.25,"2025/26":39.25}},
    "134": {"name":"VfB Stuttgart","country":"Ger","coefficient":27.5,"sum":27.5,"countryPart":18.58,"basis":"sum","seasons":{"2021/22":null,"2022/23":null,"2023/24":null,"2024/25":13,"2025/26":14.5}},
    "142": {"name":"Feyenoord","country":"Ned","coefficient":71,"sum":71,"countryPart":13.585,"basis":"sum","seasons":{"2021/22":24,"2022/23":17,"2023/24":8,"2024/25":18,"2025/26":4}},
    "148": {"name":"PSV Eindhoven","country":"Ned","coefficient":71.25,"sum":71.25,"countryPart":13.585,"basis":"sum","seasons":{"2021/22":10,"2022/23":11,"2023/24":17,"2024/25":21.25,"2025/26":12}},
    "160": {"name":"Paris Saint-Germain","country":"Fra","coefficient":132,"sum":132,"countryPart":16.699,"basis":"sum","seasons":{"2021/22":19,"2022/23":19,"2023/24":23,"2024/25":33.5,"2025/26":37.5}},
    "166": {"name":"Lille OSC","country":"Fra","coefficient":68.75,"sum":68.75,"countryPart":16.699,"basis":"sum","seasons":{"2021/22":17,"2022/23":null,"2023/24":17,"2024/25":24,"2025/26":10.75}},
    "175": {"name":"RC Lens","country":"Fra","coefficient":16.699,"sum":12.5,"countryPart":16.699,"basis":"association-20pct","seasons":{"2021/22":null,"2022/23":null,"2023/24":10,"2024/25":2.5,"2025/26":null}},
    "244": {"name":"Real Betis","country":"Esp","coefficient":74.5,"sum":74.5,"countryPart":19.409,"basis":"sum","seasons":{"2021/22":11,"2022/23":16,"2023/24":6,"2024/25":19.25,"2025/26":22.25}},
    "359": {"name":"Arsenal","country":"Eng","coefficient":119,"sum":119,"countryPart":23.903,"basis":"sum","seasons":{"2021/22":null,"2022/23":17,"2023/24":22,"2024/25":36,"2025/26":44}},
    "360": {"name":"Manchester United","country":"Eng","coefficient":76.5,"sum":76.5,"countryPart":23.903,"basis":"sum","seasons":{"2021/22":18,"2022/23":19,"2023/24":7,"2024/25":32.5,"2025/26":null}},
    "362": {"name":"Aston Villa","country":"Eng","coefficient":83,"sum":83,"countryPart":23.903,"basis":"sum","seasons":{"2021/22":null,"2022/23":null,"2023/24":17,"2024/25":30.25,"2025/26":35.75}},
    "364": {"name":"Liverpool","country":"Eng","coefficient":130,"sum":130,"countryPart":23.903,"basis":"sum","seasons":{"2021/22":33,"2022/23":19,"2023/24":20,"2024/25":29.5,"2025/26":28.5}},
    "382": {"name":"Manchester City","country":"Eng","coefficient":125.5,"sum":125.5,"countryPart":23.903,"basis":"sum","seasons":{"2021/22":27,"2022/23":33,"2023/24":28,"2024/25":14.75,"2025/26":22.75}},
    "432": {"name":"Galatasaray","country":"Tur","coefficient":53.5,"sum":53.5,"countryPart":10.375,"basis":"sum","seasons":{"2021/22":15,"2022/23":null,"2023/24":8,"2024/25":12.75,"2025/26":17.75}},
    "436": {"name":"Fenerbahçe","country":"Tur","coefficient":57.75,"sum":57.75,"countryPart":10.375,"basis":"sum","seasons":{"2021/22":5,"2022/23":17,"2023/24":14,"2024/25":11.25,"2025/26":10.5}},
    "437": {"name":"FC Porto","country":"Por","coefficient":80.75,"sum":80.75,"countryPart":14.633,"basis":"sum","seasons":{"2021/22":10,"2022/23":18,"2023/24":19,"2024/25":9.75,"2025/26":24}},
    "493": {"name":"Shakhtar Donetsk","country":"Ukr","coefficient":56.25,"sum":56.25,"countryPart":5.182,"basis":"sum","seasons":{"2021/22":6,"2022/23":11,"2023/24":10,"2024/25":11,"2025/26":18.25}},
    "494": {"name":"Slavia Praha","country":"Cze","coefficient":44,"sum":44,"countryPart":9.705,"basis":"sum","seasons":{"2021/22":10,"2022/23":6,"2023/24":15,"2024/25":4,"2025/26":9}},
    "510": {"name":"Viking Stavanger","country":"Nor","coefficient":8.247,"sum":4.5,"countryPart":8.247,"basis":"association-20pct","seasons":{"2021/22":null,"2022/23":2.5,"2023/24":null,"2024/25":null,"2025/26":2}},
    "521": {"name":"Slovan Bratislava","country":"Svk","coefficient":36,"sum":36,"countryPart":4.475,"basis":"sum","seasons":{"2021/22":6,"2022/23":12,"2023/24":8,"2024/25":6,"2025/26":4}},
    "570": {"name":"Club Brugge","country":"Bel","coefficient":75.25,"sum":75.25,"countryPart":12.45,"basis":"sum","seasons":{"2021/22":7,"2022/23":17,"2023/24":21,"2024/25":15.75,"2025/26":14.5}},
    "887": {"name":"AEK Athens","country":"Gre","coefficient":24,"sum":24,"countryPart":9.682,"basis":"sum","seasons":{"2021/22":1.5,"2022/23":null,"2023/24":3,"2024/25":2,"2025/26":17.5}},
    "1068": {"name":"Atlético Madrid","country":"Esp","coefficient":104.75,"sum":104.75,"countryPart":19.409,"basis":"sum","seasons":{"2021/22":19,"2022/23":8,"2023/24":24,"2024/25":26.5,"2025/26":27.25}},
    "2250": {"name":"Sporting CP Lisbon","country":"Por","coefficient":84,"sum":84,"countryPart":14.633,"basis":"sum","seasons":{"2021/22":16,"2022/23":14,"2023/24":12,"2024/25":14.5,"2025/26":27.5}},
    "2572": {"name":"Como","country":"Ita","coefficient":19.989,"sum":0,"countryPart":19.989,"basis":"association-20pct","seasons":{"2021/22":null,"2022/23":null,"2023/24":null,"2024/25":null,"2025/26":null}},
    "2980": {"name":"Bodø/Glimt","country":"Nor","coefficient":64,"sum":64,"countryPart":8.247,"basis":"sum","seasons":{"2021/22":15,"2022/23":3,"2023/24":8,"2024/25":21,"2025/26":17}},
    "4411": {"name":"LASK","country":"Aut","coefficient":21,"sum":21,"countryPart":6.77,"basis":"sum","seasons":{"2021/22":15,"2022/23":null,"2023/24":3,"2024/25":3,"2025/26":null}},
    "11420": {"name":"RB Leipzig","country":"Ger","coefficient":61,"sum":61,"countryPart":18.58,"basis":"sum","seasons":{"2021/22":17,"2022/23":18,"2023/24":18,"2024/25":8,"2025/26":null}},
    "21922": {"name":"Sabah FK","country":"Azb","coefficient":6,"sum":6,"countryPart":4.587,"basis":"sum","seasons":{"2021/22":null,"2022/23":null,"2023/24":2,"2024/25":2,"2025/26":2}}
    }
  };
});
