/* =========================================================================
   cupclubs2026.js — Pays des 36 clubs de chaque phase de ligue 2026-27
   (Europa League, Conference League), par identifiant ESPN.
   -------------------------------------------------------------------------
   Sert au filtre « pays » du classement par zones (cup.js). Source :
   championnat national renseigné par ESPN pour chaque club
   (/teams/{id}, champ defaultLeague, relevé le 18/10/2026) ; pour les 22
   clubs où ESPN ne renseigne que la coupe d'Europe, pays du club complété à
   la main (Ferencváros : Hongrie, Kairat : Kazakhstan, Étoile rouge :
   Serbie…). Les chapeaux du tirage ne sont publiés ni par ESPN ni ici : le
   filtre par chapeau n'existe que pour la Ligue des Champions.
   API : window.LDCCupClubs2026[slug][teamId] -> code pays (« FRA »…)
   ========================================================================= */
window.LDCCupClubs2026 = {
    'uefa.europa': {
      '103': 'ITA',     // AC Milan
      '349': 'ENG',     // AFC Bournemouth
      '140': 'NED',     // AZ Alkmaar
      '441': 'BEL',     // Anderlecht
      '20024': 'ARM',   // Ararat-Armenia
      '131': 'GER',     // Bayer Leverkusen
      '1929': 'POR',    // Benfica
      '1895': 'TUR',    // Besiktas
      '85': 'ESP',      // Celta Vigo
      '256': 'SCO',     // Celtic
      '384': 'ENG',     // Crystal Palace
      '597': 'CRO',     // Dinamo Zagreb
      '622': 'HUN',     // Ferencvaros
      '13083': 'ISR',   // Hapoel Be'er
      '11505': 'POL',   // Jagiellonia Bialystok
      '111': 'ITA',     // Juventus
      '2990': 'POL',    // Lech Poznan
      '490': 'BUL',     // Levski Sofia
      '987': 'NOR',     // Lillestrom
      '167': 'FRA',     // Lyon
      '176': 'FRA',     // Marseille
      '147': 'NED',     // NEC Nijmegen
      '3362': 'SVN',    // NK Celje
      '1010': 'GRE',    // OFI Crete
      '435': 'GRE',     // Olympiacos
      '617': 'CYP',     // Omonia Nicosia
      '2790': 'AUT',    // RB Salzburg
      '89': 'ESP',      // Real Sociedad
      '3746': 'AUT',    // SK Sturm Graz
      '433': 'CZE',     // Sparta Prague
      '169': 'FRA',     // Stade Rennais
      '366': 'ENG',     // Sunderland
      '7911': 'GER',    // TSG Hoffenheim
      '21615': 'POR',   // Torreense
      '5807': 'BEL',    // Union St.-Gilloise
      '11706': 'CZE'   // Viktoria Plzen
    },
    'uefa.europa.conf': {
      '7853': 'DEN',    // AGF
      '174': 'FRA',     // AS Monaco
      '139': 'NED',     // Ajax Amsterdam
      '105': 'ITA',     // Atalanta
      '20710': 'BIH',   // Borac Banja Luka
      '2994': 'POR',    // Braga
      '331': 'ENG',     // Brighton & Hove Albion
      '10834': 'BUL',   // CSKA Sofia
      '8089': 'ROU',    // CSU Craiova
      '21943': 'ALB',   // Egnatia
      '909': 'DEN',     // F.C. København
      '7672': 'SUI',    // FC Lugano
      '572': 'DEN',     // FC Midtjylland
      '3101': 'DEN',    // FC Nordsjælland
      '3024': 'SUI',    // FC Thun
      '152': 'NED',     // FC Twente
      '2922': 'ESP',    // Getafe
      '489': 'CRO',     // Hajduk Split
      '262': 'SCO',     // Heart of Midlothian
      '20025': 'GEO',   // Iberia 1999
      '20703': 'AND',   // Inter D'Escaldes
      '7922': 'CZE',    // Jablonec
      '3611': 'BEL',    // KAA Gent
      '2528': 'KAZ',    // Kairat Almaty
      '20028': 'LTU',   // Kauno Zalgiris
      '8169': 'FIN',    // KuPS Kuopio
      '17856': 'GIB',   // Lincoln Red Imps
      '20301': 'SWE',   // Mjällby AIF
      '22281': 'CYP',   // Pafos
      '443': 'GRE',     // Panathinaikos
      '2290': 'SRB',    // Red Star Belgrade
      '19246': 'LVA',   // Riga FC
      '126': 'GER',     // SC Freiburg
      '620': 'NOR',     // SK Brann
      '936': 'BEL',     // Sint-Truidense
      '997': 'TUR'     // Trabzonspor
    }
};
